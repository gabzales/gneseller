import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSameOriginRequest } from "@/lib/origin-guard";
import { orderProviderKey } from "@/lib/provider/vipibmstore";

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
    const { data: profile } = await admin.from("users").select("balance").eq("id", user.id).maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: "user_not_found", message: known.user_not_found.message }, { status: 404 });
    }
    if (profile.balance < duration.price) {
      return NextResponse.json({ error: "insufficient_balance", message: known.insufficient_balance.message }, { status: 402 });
    }

    // Idempotency key must be stable per attempt at the SAME purchase, not
    // random per retry -- otherwise a network retry could order two real
    // keys from the provider for one balance debit. Deriving it from
    // user+product+duration+minute bucket keeps accidental double-clicks
    // from double-ordering while still allowing a genuinely new purchase
    // a moment later.
    const idempotencyKey = `${user.id}:${productId}:${durationId}:${Math.floor(Date.now() / 60000)}`;
    const providerResult = await orderProviderKey({
      productItemId: duration.provider_item_id || "",
      idempotencyKey,
      customerReference: user.id,
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
    const { data, error } = await admin.rpc("generate_key_manual", {
      p_user_id: user.id,
      p_product_id: productId,
      p_duration_id: durationId,
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
