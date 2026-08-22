import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSameOriginRequest } from "@/lib/origin-guard";
import { getGenspayConfig } from "@/lib/provider/genspay";
import { getTopupPackagesAsAdmin } from "@/lib/data/topup-packages";

/**
 * Creates a pending QRIS transaction via GensPay and returns the checkout
 * payload (QR string) to the client.
 *
 * Contract per GensPay's official API documentation:
 *   POST {GENSPAY_BASE_URL}/transaction/create
 *   headers: { "X-API-Key": GENSPAY_API_KEY }
 *   body: { amount: number, order_id: string, payment_method: "qris" }
 *   response 201: { success: true, data: { qr_string, amount, fee,
 *                   net_amount, payment_method, expiry_time } }
 *   response error (400/401/409/503): bare { "error": "message" } at the
 *                   root -- no `success` field, no nested `message`.
 *
 * ⚠️ callback_url: this codebase never sent this field on ANY create
 * request before this fix, and nothing else in the repo configures a
 * webhook URL either. If GensPay's merchant dashboard doesn't already
 * have a webhook URL saved as an account-wide default, that's a very
 * plausible explanation for "customer paid, balance never credited" --
 * GensPay would have nowhere to send the transaction.updated callback.
 * Now sent explicitly per-request (below) so it doesn't silently depend
 * on a dashboard setting neither of us can see from here. STILL worth
 * checking GensPay's own dashboard for a webhook URL field -- if one's
 * already saved there pointing somewhere stale/wrong, fix it on their
 * side too.
 *
 * order_id must be alphanumeric with dashes/underscores ONLY (confirmed
 * from docs), max 50 characters (confirmed via /api/debug/genspay --
 * real response: { error: "Validation failed", details: [{ field:
 * "order_id", message: "Order ID must be at most 50 characters" }] }).
 * We now use "topup-<24 hex chars>" (30 chars) rather than embedding
 * user_id/nominal in it -- see the webhook, which looks those up from
 * the pending topups row by merchant_ref instead of parsing the string.
 *
 * No per-request HMAC signature on create (unlike Tripay) -- GensPay auths
 * purely via the X-API-Key header. The webhook callback (settlement) is
 * where GensPay's own signature applies -- see
 * src/app/api/webhooks/topup/route.ts.
 *
 * settle_topup() underneath is untouched by this swap; only the gateway
 * call + field names here and in the webhook changed.
 */

type GenspayCreateResponse = {
  success?: boolean;
  // Real GensPay error shape is a bare { "error": "message" } at the root
  // (confirmed against official docs), not { success:false, message }.
  // Kept optional since a successful response won't include this field.
  error?: string;
  data?: {
    qr_string: string;
    amount?: number;
    expiry_time?: string | number;
  };
};

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }

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

  const allowed = await checkRateLimit(admin, `topup-create:${user.id}`, {
    maxHits: 10,
    windowSeconds: 60,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Terlalu banyak percobaan, coba lagi sebentar." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const nominal = Number(body?.nominal);

  // Never trust a client-supplied bonus/total -- only nominal tiers
  // currently active in public.topup_packages (admin-editable, see
  // 0006_reseller_ops.sql) are valid, and the bonus is looked up
  // server-side from that same source. Falls back to the hardcoded
  // TOPUP_PACKAGES in mock-data.ts if the table is empty/unreachable, so
  // this never breaks before the migration has been run.
  const packages = await getTopupPackagesAsAdmin();
  const pkg = packages.find((p) => p.nominal === nominal);
  if (!pkg) {
    return NextResponse.json({ error: "invalid_nominal" }, { status: 400 });
  }

  const { apiKey: GENSPAY_API_KEY, baseUrl: GENSPAY_BASE_URL } = await getGenspayConfig();
  if (!GENSPAY_BASE_URL || !GENSPAY_API_KEY) {
    return NextResponse.json(
      {
        error: "payment_gateway_not_configured",
        message:
          "Payment gateway belum dikonfigurasi. Isi di /dashboard/admin/settings/genspay atau GENSPAY_BASE_URL/GENSPAY_API_KEY di environment.",
      },
      { status: 503 }
    );
  }

  // Unique per attempt so a retried click never collides with an earlier
  // pending row's merchant_ref (unique constraint, 0002 migration). Kept
  // as our own idempotency key -- GensPay's create body only needs
  // order_id + amount, but we still pass this same value as order_id so
  // the webhook can parse it back into user/nominal/nonce.
  //
  // FIX (confirmed against official GensPay docs): order_id must be
  // "alphanumeric with dashes/underscores" ONLY -- the previous format
  // used ":" as a separator ("topup:<user_id>:<nominal>:<nonce>"), which
  // is NOT in the allowed character set. Every single create request
  // would have been rejected with 400 "Order ID must be alphanumeric
  // with dashes/underscores" once pointed at the real GensPay API. Dashes
  // used as the separator instead -- user.id (a UUID) already contains
  // dashes itself, so we can't split naively on "-" to recover it later;
  // the webhook route parses this with a fixed prefix + suffix split
  // instead of a blind .split("-") (see webhooks/topup/route.ts).
  // FIX (confirmed via /api/debug/genspay?realistic=1): GensPay rejects
  // order_id over 50 characters -- { error: "Validation failed", details:
  // [{ field: "order_id", message: "Order ID must be at most 50
  // characters" }] }. The old "topup-<user_uuid>-<nominal>-<nonce>"
  // format was 58-60 chars (a bare UUID alone is 36), so EVERY real
  // checkout was rejected before ever reaching the QR-generation step --
  // this is why "Bayar via QRIS" always failed with a generic
  // "Validation failed" no matter the nominal.
  //
  // Rather than trying to cram user_id + nominal into a shorter encoding
  // that still fits under 50 chars, we stop encoding them into order_id
  // at all: the pending row inserted just below (create_pending_topup)
  // already stores user_id/nominal/bonus keyed by this exact merchant_ref,
  // so the webhook can look them up from the DB by merchant_ref instead
  // of reverse-parsing the order_id string. order_id now only needs to be
  // unique -- "topup-<24 hex chars>" is 30 chars, comfortably under the
  // limit with room to spare.
  const orderId = `topup-${randomBytes(12).toString("hex")}`;

  // FIX: callback_url now sent explicitly -- see header docstring for why
  // this was likely the actual reason paid transactions never credited
  // balance. Falls back to the known production domain if APP_URL isn't
  // set, so this still works even before the new env var is added.
  const appUrl = (process.env.APP_URL || "https://ghostseller.my.id").replace(/\/+$/, "");
  const callbackUrl = `${appUrl}/api/webhooks/topup`;

  let genspayRes: Response;
  try {
    genspayRes = await fetch(`${GENSPAY_BASE_URL.replace(/\/$/, "")}/transaction/create`, {
      method: "POST",
      headers: {
        "X-API-Key": GENSPAY_API_KEY,
        "Content-Type": "application/json",
      },
      // payment_method included explicitly to match GensPay's documented
      // request shape exactly, rather than relying on an assumed default.
      body: JSON.stringify({
        amount: pkg.nominal,
        order_id: orderId,
        payment_method: "qris",
        callback_url: callbackUrl,
      }),
    });
  } catch (err) {
    console.error("GensPay create-transaction request failed:", err);
    return NextResponse.json({ error: "gateway_unreachable" }, { status: 502 });
  }

  const genspayJson = (await genspayRes.json().catch(() => null)) as GenspayCreateResponse | null;

  // FIX (confirmed against official GensPay docs): a 201 success has
  // `success: true` in the body; every documented error case (400/401/
  // 409/503) is a bare `{ "error": "message" }` with NO `success` field
  // at all. Checking `!genspayJson?.success` on an error response is
  // already correctly falsy (undefined), so that part was fine -- the
  // bug was reading `.message` for the error text, which real GensPay
  // errors never populate, so the actual reason (e.g. "Minimum amount
  // is Rp 1.000", "Invalid or inactive API key", "Order ID already
  // exists for this project") was silently swallowed into a generic
  // fallback string instead of surfacing to the user/logs.
  if (!genspayRes.ok || !genspayJson?.success || !genspayJson.data?.qr_string) {
    return NextResponse.json(
      { error: "gateway_rejected", message: genspayJson?.error || "Gagal membuat transaksi." },
      { status: 502 }
    );
  }

  // Record the pending topup so History shows it immediately; the webhook
  // settles this exact row (matched by merchant_ref/order_id) once payment lands.
  const { error: pendingError } = await admin.rpc("create_pending_topup", {
    p_user_id: user.id,
    p_merchant_ref: orderId,
    p_nominal: pkg.nominal,
    p_bonus: pkg.bonus,
  });
  if (pendingError) {
    console.error("create_pending_topup failed:", pendingError.message);
    // The GensPay transaction still exists and the webhook will retry
    // settle_topup() regardless -- don't block the checkout redirect over
    // a failure to pre-insert the pending row.
  }

  return NextResponse.json({
    reference: orderId,
    qrString: genspayJson.data.qr_string,
    amount: genspayJson.data.amount ?? pkg.nominal,
    expiredAt: genspayJson.data.expiry_time ?? null,
  });
}

