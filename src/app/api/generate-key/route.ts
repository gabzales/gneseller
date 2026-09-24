import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSameOriginRequest } from "@/lib/origin-guard";
import { orderProviderKey, providerErrorToCustomerMessage } from "@/lib/provider/vipibmstore";

// Provider call (orderProviderKey) can legitimately take up to
// REQUEST_TIMEOUT_MS (25s) waiting on vipibmstore.com. Without this,
// Vercel's default serverless timeout (10s on Hobby plans) kills the
// function mid-request and returns its own 502 HTML error page --
// which is what breaks the frontend's res.json() parse with
// "Unexpected token '<'". This must be >= REQUEST_TIMEOUT_MS below.
export const maxDuration = 30;

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "supabase_not_configured", message: "Backend belum terhubung (mode demo)." },
      { status: 503 }
    );
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }

  const { productId, durationId } = await request.json().catch(() => ({}));
  if (!productId || !durationId || typeof productId !== "string" || typeof durationId !== "string") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // 1. Identify the caller from their session cookie -- never trust a
  //    user id sent in the request body.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "service_role_missing" }, { status: 500 });
  }

  // 2. Cap how often a single account can hit this endpoint -- a compromised
  //    session or a scripted client shouldn't be able to hammer the RPC.
  const allowed = await checkRateLimit(admin, `generate-key:${user.id}`, {
    maxHits: 20,
    windowSeconds: 60,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Terlalu banyak percobaan, coba lagi sebentar." },
      { status: 429 }
    );
  }

  // 3. Look up how this specific duration is stocked -- 'manual' draws from
  //    the key_stock pool an admin filled in via /dashboard/admin, 'auto'
  //    generates live from the vipibmstore.com reseller API.
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
    insufficient_balance: { status: 402, message: "Saldo tidak mencukupi." },
    invalid_product_or_duration: { status: 400, message: "Produk/durasi tidak valid." },
    user_not_found: { status: 404, message: "Akun tidak ditemukan." },
    out_of_stock: { status: 409, message: "Stok key untuk paket ini sedang habis." },
  };

  if (duration.stock_mode === "auto") {
    // Check the balance BEFORE spending a real provider order -- without
    // this, a reseller with insufficient balance would still trigger a
    // real (billed) key purchase at vipibmstore.com, only to have our own
    // generate_key RPC reject it afterwards. This precheck is a courtesy,
    // not the source of truth: a concurrent purchase can still race
    // between this read and the RPC call below, which is why the RPC's
    // own balance check (and the post-hoc error handling further down)
    // stays in place as the real guard either way.
    // FIX: this used to compare against duration.price (the raw DEFAULT
    // price), not the reseller's actual effective price (tier discount or
    // custom_prices override, same effective_key_price() the RPC below
    // uses to both check and charge). Two real consequences:
    //   1. A reseller with a cheaper tier price could get wrongly
    //      rejected with "Saldo tidak mencukupi" here even though their
    //      balance was enough for what they'd actually be charged --
    //      this precheck was stricter than the real charge.
    //   2. The opposite (rarer but worse): a reseller whose effective
    //      price is HIGHER than default (e.g. an admin-set custom price
    //      override) could pass this precheck, triggering a REAL
    //      provider order (billed to the store) at orderProviderKey()
    //      below, only for generate_key's own balance check to then
    //      reject it -- a key already paid for at the provider with no
    //      matching balance debit from the reseller.
    const { data: profile } = await admin.from("users").select("balance").eq("id", user.id).maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: "user_not_found", message: known.user_not_found.message }, { status: 404 });
    }
    const { data: effectivePrice, error: priceError } = await admin.rpc("effective_key_price", {
      p_user_id: user.id,
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

    // Idempotency key must be stable per attempt at the SAME purchase, not
    // random per retry -- otherwise a network retry could order two real
    // keys from the provider for one balance debit. Deriving it from
    // user+product+duration+minute bucket keeps accidental double-clicks
    // from double-ordering while still allowing a genuinely new purchase
    // a moment later.
    const idempotencyKey = `${user.id}:${productId}:${durationId}:${Math.floor(Date.now() / 60000)}`;
    const providerStartedAt = Date.now();
    const providerResult = await orderProviderKey({
      productItemId: duration.provider_item_id || "",
      idempotencyKey,
      customerReference: user.id,
    });
    // Timing log so a future 502 (Vercel killing the function before this
    // resolves) is visible in Vercel Runtime Logs even without a thrown
    // error -- a 502 from an external timeout never reaches our own
    // catch/error handling, so this is the only trace we get of it.
    console.log("orderProviderKey took", Date.now() - providerStartedAt, "ms", {
      success: providerResult.success,
    });

    if (!providerResult.success) {
      // Simpan ke provider_error_log biar owner bisa lihat riwayat/pola
      // kegagalan lewat GUI (/dashboard/admin/provider-debug) tanpa perlu
      // buka Vercel Runtime Logs. Best-effort -- kegagalan nyimpen log
      // tidak boleh sampai gagalin response error yang sebenarnya ke user.
      // Log-nya tetap simpan pesan MENTAH dari provider (buat debugging
      // owner) -- yang diubah cuma pesan yang dibalas ke customer di bawah.
      admin
        .from("provider_error_log")
        .insert({
          user_id: user.id,
          product_id: productId,
          duration_id: durationId,
          provider_item_id: duration.provider_item_id || null,
          error_message: `[${providerResult.code}] ${providerResult.message || "(tanpa pesan)"}`,
        })
        .then(({ error: logError }) => {
          if (logError) console.error("gagal simpan provider_error_log:", logError.message);
        });
      // FIX: pesan mentah dari provider (termasuk kode sensitif seperti
      // INVALID_SIGNATURE) sebelumnya diteruskan APA ADANYA ke customer.
      // Sekarang dipetakan lewat tabel resmi VIP Best Mods -- lihat
      // providerErrorToCustomerMessage() di vipibmstore.ts.
      const customerFacing = providerErrorToCustomerMessage(providerResult.code, providerResult.message || "");
      return NextResponse.json({ error: "provider_error", message: customerFacing.message }, { status: 502 });
    }
    const providerKey = providerResult.data?.codes?.[0];
    if (!providerKey) {
      return NextResponse.json({ error: "out_of_stock", message: known.out_of_stock.message }, { status: 409 });
    }

    const { data, error } = await admin.rpc("generate_key", {
      p_user_id: user.id,
      p_product_id: productId,
      p_duration_id: durationId,
      p_key_string: providerKey,
    });

    if (!error) return NextResponse.json({ key: data });

    const match = Object.entries(known).find(([code]) => error.message.includes(code));
    const info = match?.[1] ?? { status: 500, message: "Gagal membuat key." };
    // NOTE: the provider key has already been issued at this point (and
    // billed on their end) even though our own balance debit failed --
    // this is the same "external side-effect before local commit" tradeoff
    // GHOST NEWERA's resolveProductKey() accepts. Logged so it can be
    // reconciled manually rather than silently lost.
    console.error("generate_key RPC failed after provider already issued a key", {
      userId: user.id, productId, durationId, error: error.message,
    });
    return NextResponse.json({ error: match?.[0] ?? "unknown", message: info.message }, { status: info.status });
  }

  // 4. Manual mode: atomically claim one row from key_stock inside
  //    generate_key_manual() (see supabase/migrations/0003_admin_provider.sql).
  //    No local key_string generation anymore -- the key must be a real one
  //    an admin pasted in via /dashboard/admin/products/[id].
  let lastError: { message: string } | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const attemptStartedAt = Date.now();
    const { data, error } = await admin.rpc("generate_key_manual", {
      p_user_id: user.id,
      p_product_id: productId,
      p_duration_id: durationId,
    });
    console.log("generate_key_manual attempt", attempt, "took", Date.now() - attemptStartedAt, "ms", {
      hasError: Boolean(error),
    });

    if (!error) return NextResponse.json({ key: data });

    lastError = error;
    // out_of_stock / insufficient_balance etc. are never worth retrying;
    // only loop on the astronomically unlikely key_string race.
    const isCollision = error.message.includes("duplicate key") || error.message.includes("key_string");
    if (!isCollision) break;
  }

  const match = Object.entries(known).find(([code]) => lastError?.message.includes(code));
  const info = match?.[1] ?? { status: 500, message: "Gagal membuat key." };
  return NextResponse.json({ error: match?.[0] ?? "unknown", message: info.message }, { status: info.status });
}
