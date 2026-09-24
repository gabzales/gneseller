import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Usage: GET /api/debug/balance-check?secret=X&email=user@example.com&product_id=xxx&duration_id=yyy
 *
 * Reads the LIVE balance + effective_key_price straight from the DB at
 * request time, side by side -- isolates whether "Saldo tidak
 * mencukupi" despite a seemingly-sufficient displayed balance is:
 *   (a) a frontend staleness bug (dashboard shows an old cached number,
 *       real DB balance is actually lower), or
 *   (b) a genuine backend price mismatch (effective_key_price returns a
 *       higher number at generate-time than what the Generate page
 *       displayed, e.g. price_tiers/custom_prices changed in between).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const debugSecret = (process.env.GENSPAY_DEBUG_SECRET || process.env.SETUP_ADMIN_SECRET || "").trim();
  const provided = searchParams.get("secret");
  if (!debugSecret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!provided || provided !== debugSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = searchParams.get("email");
  let productId = searchParams.get("product_id");
  let durationId = searchParams.get("duration_id");
  const productName = searchParams.get("product_name");
  const durationLabel = searchParams.get("duration_label");
  if (!email) {
    return NextResponse.json({ error: "missing_email", message: "Tambahkan ?email=user@example.com" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  // Kalau product_id/duration_id (UUID) tidak diisi, cari lewat nama --
  // lebih gampang dari nyari UUID manual di Supabase table editor.
  if (!productId && productName) {
    const { data: p } = await admin.from("products").select("id").ilike("name", `%${productName}%`).maybeSingle();
    productId = p?.id ?? null;
  }
  if (productId && !durationId && durationLabel) {
    const { data: d } = await admin
      .from("product_durations")
      .select("id")
      .eq("product_id", productId)
      .ilike("label", `%${durationLabel}%`)
      .maybeSingle();
    durationId = d?.id ?? null;
  }

  const { data: user, error: userErr } = await admin
    .from("users")
    .select("id, email, balance, total_topup, banned")
    .eq("email", email)
    .maybeSingle();
  if (userErr || !user) {
    return NextResponse.json({ error: "user_not_found", message: userErr?.message }, { status: 404 });
  }

  const result: Record<string, unknown> = {
    liveBalance: user.balance,
    liveTotalTopup: user.total_topup,
    banned: user.banned,
    note: "liveBalance ini dibaca LANGSUNG dari DB saat ini juga -- kalau ini beda dari yang keliatan di dashboard, berarti dashboard nampilin data basi/cache. Kalau SAMA, berarti masalahnya di effective_key_price di bawah.",
  };

  if (productId && durationId) {
    const { data: duration } = await admin
      .from("product_durations")
      .select("price, label")
      .eq("product_id", productId)
      .eq("id", durationId)
      .maybeSingle();

    if (!duration) {
      result.priceCheck = { error: "invalid_product_or_duration" };
    } else {
      const { data: effectivePrice, error: priceErr } = await admin.rpc("effective_key_price", {
        p_user_id: user.id,
        p_product_id: productId,
        p_duration_id: durationId,
        p_default_price: duration.price,
      });

      const { data: customPrice } = await admin
        .from("custom_prices")
        .select("price")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .eq("duration_id", durationId)
        .maybeSingle();

      const { data: matchingTiers } = await admin
        .from("price_tiers")
        .select("min_total_topup, price")
        .eq("product_id", productId)
        .eq("duration_id", durationId)
        .order("min_total_topup", { ascending: false });

      result.priceCheck = {
        defaultPrice: duration.price,
        customPriceOverride: customPrice?.price ?? null,
        allPriceTiers: matchingTiers ?? [],
        effectivePriceRightNow: priceErr ? `error: ${priceErr.message}` : effectivePrice,
        sufficientBalance: typeof effectivePrice === "number" ? user.balance >= effectivePrice : null,
      };
    }
  } else if (productName || durationLabel) {
    // FIX: sebelumnya kalau pencarian nama produk/durasi gagal cocok,
    // priceCheck cuma hilang begitu saja tanpa penjelasan -- sekarang
    // dikasih tahu persis kenapa, plus daftar produk yang ADA supaya
    // bisa langsung dicoba lagi dengan nama yang benar.
    const { data: allProducts } = await admin.from("products").select("id, name").eq("active", true);
    result.priceCheck = {
      error: !productId ? "product_name_not_matched" : "duration_label_not_matched",
      message: !productId
        ? `Tidak ada produk aktif yang namanya mengandung "${productName}".`
        : `Produk ketemu, tapi tidak ada durasi yang labelnya mengandung "${durationLabel}".`,
      availableProducts: allProducts?.map((p) => p.name) ?? [],
    };
  }

  return NextResponse.json(result);
}
