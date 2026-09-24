import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPartnerApiConfig, isValidPartnerApiKey } from "@/lib/provider/partner-auth";
import { orderProviderKey } from "@/lib/provider/vipibmstore";

// FIX (Sep 2026): sama alasannya kayak di products/route.ts -- paksa
// dynamic biar getPartnerApiConfig() (dan semua query lain di bawah)
// gak pernah kena static/data cache Next.js.
export const dynamic = 'force-dynamic';

// POST /api/v1/partner/generate-key
// Header wajib : X-API-Key
// Body         : { productId, durationId, idempotencyKey? }
//
// Versi server-to-server dari /api/generate-key (lihat file itu untuk
// alasan tiap langkah -- logikanya sengaja dibuat SAMA PERSIS, cuma
// identitas pemanggil beda sumbernya:
//   /api/generate-key   -> dari cookie session Supabase Auth (browser reseller)
//   /partner/generate-key -> dari X-API-Key (toko client lain, mis. RYAN NEW ERA)
//
// resellerId (akun yang saldonya dipotong) diambil dari app_settings
// 'partner_api', BUKAN dari body request -- supaya toko client tidak
// bisa "pura-pura jadi reseller lain" cuma dengan ganti field body.
//
// Same maxDuration reasoning as /api/generate-key: orderProviderKey()
// bisa nunggu vipibmstore.com sampai puluhan detik.
export const maxDuration = 30;

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "supabase_not_configured", message: "Backend belum terhubung (mode demo)." },
      { status: 503 }
    );
  }

  const { apiKey, resellerId } = await getPartnerApiConfig();
  const headerKey = request.headers.get("x-api-key")?.trim() || null;
  if (!apiKey || !isValidPartnerApiKey(headerKey, apiKey)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!resellerId) {
    return NextResponse.json(
      { error: "partner_reseller_not_configured", message: "Akun reseller partner belum di-set di app_settings('partner_api')." },
      { status: 500 }
    );
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "service_role_missing" }, { status: 500 });
  }

  const { productId, durationId, idempotencyKey } = await request.json().catch(() => ({}));
  if (!productId || !durationId || typeof productId !== "string" || typeof durationId !== "string") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Rate limit di-key oleh API key, bukan per-user -- ini satu klien
  // (server RyanNewEra), bukan banyak browser reseller. Angka lebih
  // longgar dari /api/generate-key karena satu toko client bisa restock
  // beberapa varian sekaligus saat trafik lagi ramai.
  const allowed = await checkRateLimit(admin, `partner-generate-key:${apiKey.slice(0, 12)}`, {
    maxHits: 60,
    windowSeconds: 60,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Terlalu banyak percobaan, coba lagi sebentar." },
      { status: 429 }
    );
  }

  const { data: duration, error: durationError } = await admin
    .from("product_durations")
    .select("stock_mode, provider_item_id, price")
    .eq("product_id", productId)
    .eq("id", durationId)
    .maybeSingle();

  if (durationError || !duration) {
    return NextResponse.json({ error: "invalid_product_or_duration", message: "Produk/durasi tidak valid." }, { status: 400 });
  }

  const known: Record<string, { status: number; message: string }> = {
    insufficient_balance: { status: 402, message: "Saldo akun partner tidak mencukupi." },
    invalid_product_or_duration: { status: 400, message: "Produk/durasi tidak valid." },
    user_not_found: { status: 404, message: "Akun partner tidak ditemukan." },
    out_of_stock: { status: 409, message: "Stok key untuk paket ini sedang habis." },
  };

  if (duration.stock_mode === "auto") {
    const { data: profile } = await admin.from("users").select("balance").eq("id", resellerId).maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: "user_not_found", message: known.user_not_found.message }, { status: 404 });
    }
    const { data: effectivePrice, error: priceError } = await admin.rpc("effective_key_price", {
      p_user_id: resellerId,
      p_product_id: productId,
      p_duration_id: durationId,
      p_default_price: duration.price,
    });
    if (priceError || typeof effectivePrice !== "number") {
      return NextResponse.json({ error: "invalid_product_or_duration", message: known.invalid_product_or_duration.message }, { status: 400 });
    }
    if (profile.balance < effectivePrice) {
      return NextResponse.json({ error: "insufficient_balance", message: known.insufficient_balance.message }, { status: 402 });
    }

    const idemKey = idempotencyKey || `partner:${resellerId}:${productId}:${durationId}:${Math.floor(Date.now() / 60000)}`;
    const providerResult = await orderProviderKey({
      productItemId: duration.provider_item_id || "",
      idempotencyKey: idemKey,
      customerReference: resellerId,
    });

    if (!providerResult.success) {
      return NextResponse.json(
        { error: "provider_error", message: providerResult.message || "Gagal generate key dari provider." },
        { status: 502 }
      );
    }
    const providerKey = providerResult.data?.codes?.[0];
    if (!providerKey) {
      return NextResponse.json({ error: "out_of_stock", message: known.out_of_stock.message }, { status: 409 });
    }

    const { data, error } = await admin.rpc("generate_key", {
      p_user_id: resellerId,
      p_product_id: productId,
      p_duration_id: durationId,
      p_key_string: providerKey,
    });

    if (!error) return NextResponse.json({ key: data });

    const match = Object.entries(known).find(([code]) => error.message.includes(code));
    const info = match?.[1] ?? { status: 500, message: "Gagal membuat key." };
    console.error("[partner/generate-key] generate_key RPC failed after provider already issued a key", {
      resellerId, productId, durationId, error: error.message,
    });
    return NextResponse.json({ error: match?.[0] ?? "unknown", message: info.message }, { status: info.status });
  }

  // Mode manual: ambil dari key_stock pool GhostSeller sendiri (bukan
  // vipibmstore) -- berguna kalau admin GhostSeller sengaja nyetok key
  // manual untuk dijual lagi ke toko client lewat partner API ini.
  let lastError: { message: string } | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data, error } = await admin.rpc("generate_key_manual", {
      p_user_id: resellerId,
      p_product_id: productId,
      p_duration_id: durationId,
    });
    if (!error) return NextResponse.json({ key: data });

    lastError = error;
    const isCollision = error.message.includes("duplicate key") || error.message.includes("key_string");
    if (!isCollision) break;
  }

  const match = Object.entries(known).find(([code]) => lastError?.message.includes(code));
  const info = match?.[1] ?? { status: 500, message: "Gagal membuat key." };
  return NextResponse.json({ error: match?.[0] ?? "unknown", message: info.message }, { status: info.status });
}
