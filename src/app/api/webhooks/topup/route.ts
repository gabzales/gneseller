import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getGenspayConfig } from "@/lib/provider/genspay";

/**
 * GensPay QRIS webhook handler (see src/app/api/topup/create/route.ts,
 * which creates the transaction this callback settles).
 *
 * Contract per GensPay's official API documentation (not just cross-
 * checked against another integration this time -- confirmed directly):
 *
 *   headers: { "X-GensPay-Signature": hex sha256(JSON.stringify(body) + GENSPAY_API_KEY) }
 *   body: {
 *     event: "transaction.updated",   -- ALWAYS this, never a per-status event name
 *     data: {
 *       order_id: string,             -- our own idempotency key,
 *                                        "topup-<24 hex chars>" (dashes
 *                                        only, max 50 chars total --
 *                                        GensPay rejects order_id
 *                                        containing ":" or other
 *                                        punctuation, or over 50 chars,
 *                                        with a 400). user_id/nominal/
 *                                        bonus are looked up from the
 *                                        pending topups row by
 *                                        merchant_ref (below), not
 *                                        parsed out of this string.
 *       status: "SUCCESS" | "EXPIRED" | "FAILED",  -- uppercase
 *       amount?: number,
 *       fee?: number,
 *       net_amount?: number,
 *       ...
 *     },
 *     timestamp: string
 *   }
 *
 * IMPORTANT: this is plain SHA256(rawBody + secret), NOT HMAC-SHA256 like
 * Tripay's callback signature was. Don't "fix" this back to createHmac --
 * that would silently break verification against the real GensPay
 * callback (the two algorithms produce different digests for the same
 * input).
 *
 * GensPay retries up to 5 times with exponential backoff on anything
 * other than a 2xx response -- every return path below stays inside that
 * contract (invalid signature is the one deliberate exception, returning
 * 401 so a forged/corrupted request doesn't get endlessly retried as if
 * it were a transient failure).
 *
 * The idempotent settle_topup() RPC underneath is untouched by this swap.
 */

async function verifySignature(rawBody: string, signatureHeader: string | null) {
  // Reads from app_settings (admin panel) first, GENSPAY_API_KEY env as
  // fallback -- same source of truth as topup/create/route.ts, via
  // getGenspayConfig()'s in-memory cache so this doesn't add a DB round
  // trip to every webhook call beyond the first.
  const { apiKey: secret } = await getGenspayConfig();
  if (!secret || !signatureHeader) return false;

  const expected = createHash("sha256").update(rawBody + secret).digest();

  // Reject anything that isn't a same-length hex string BEFORE touching
  // timingSafeEqual, which throws (rather than returning false) on a
  // buffer-length mismatch.
  if (!/^[0-9a-f]+$/i.test(signatureHeader) || signatureHeader.length !== expected.length * 2) {
    return false;
  }

  const provided = Buffer.from(signatureHeader, "hex");
  return timingSafeEqual(expected, provided);
}

// bonusFor() removed -- bonus now comes straight from the pending topups
// row (see below), which was populated from the real, admin-editable
// public.topup_packages table at checkout time. The hardcoded tier table
// that used to live here had already drifted from topup_packages (compare
// old tiers to TopupPackagesManager.tsx) -- any nominal an admin added or
// changed via the panel would have silently settled with the wrong bonus,
// or 0.


export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-genspay-signature");

  if (!(await verifySignature(rawBody, signature))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: {
    event?: string;
    data?: { order_id?: string; amount?: number; net_amount?: number; fee?: number; status?: string };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // FIX (confirmed against official GensPay docs): the event name is
  // ALWAYS "transaction.updated" -- there's no separate "payment.success"
  // event. Status lives in data.status ("SUCCESS" / "EXPIRED" / "FAILED",
  // uppercase). The old check here never matched a real GensPay callback.
  if (payload.event !== "transaction.updated") {
    return NextResponse.json({ ok: true, ignored: payload.event ?? "unknown" });
  }

  const orderId = payload.data?.order_id;
  if (typeof orderId !== "string") {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }

  // FIX: order_id is now just "topup-<24 hex chars>" (see
  // topup/create/route.ts -- shortened to fit GensPay's confirmed 50-char
  // order_id limit, which no longer leaves room to encode user_id +
  // nominal into the string itself). Instead, look up the pending row
  // create_pending_topup() already inserted at checkout time, keyed by
  // this exact merchant_ref, and read user_id/nominal/bonus from there.
  //
  // This also fixes a second, previously-unreachable bug: bonusFor()
  // below duplicated a hardcoded bonus-tier table that had already
  // drifted from the real, admin-editable public.topup_packages table
  // (compare the tiers here to TopupPackagesManager.tsx) -- any nominal
  // an admin added/changed via the panel would silently get bonus=0 (or
  // the wrong bonus) once settled. Reading `bonus` from the pending row
  // instead uses the exact bonus that was looked up from
  // topup_packages at checkout time, so it can never drift.
  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "service_role_missing" }, { status: 500 });
  }

  const { data: pending, error: pendingLookupError } = await admin
    .from("topups")
    .select("user_id, nominal, bonus")
    .eq("merchant_ref", orderId)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingLookupError) {
    console.error("Topup webhook pending-row lookup failed:", pendingLookupError.message);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!pending) {
    // Either a stale/replayed webhook for an already-settled row (fine to
    // ack so GensPay stops retrying), or an order_id we never created
    // (log it -- shouldn't happen since order_id came from our own
    // create route, but worth knowing about if it ever does).
    console.error(`Topup webhook: no pending row for merchant_ref=${orderId}`);
    return NextResponse.json({ ok: true, ignored: "no_pending_row" });
  }
  const userId = pending.user_id as string;
  const nominal = pending.nominal as number;
  const bonus = pending.bonus as number;

  if (payload.data?.status !== "SUCCESS") {
    // EXPIRED / FAILED -- nothing to credit. Ack so GensPay stops
    // retrying (per their docs: up to 5 retries with exponential backoff
    // on anything other than a 2xx response).
    return NextResponse.json({ ok: true, ignored: payload.data?.status ?? "unknown_status" });
  }

  // FIX (confirmed against a real /transaction/create response via
  // /api/debug/genspay): GensPay adds its own fee ON TOP of the amount we
  // request -- create-time response for a requested amount:1000 came back
  // as { amount: 1257, fee: 257, net_amount: 1000 }. `amount` is the GROSS
  // total the customer actually pays via the QR (nominal + GensPay's fee);
  // `net_amount` is what we actually receive, which is the only field
  // that can ever equal our own `nominal`.
  //
  // The previous check compared the webhook's `data.amount` (gross)
  // directly against `nominal` (net) -- that would have made EVERY real,
  // successfully-paid top-up fail this check and get rejected with
  // amount_mismatch, since gross never equals net once a fee is added.
  // Comparing against `net_amount` instead (falling back to `amount` only
  // if `net_amount` isn't present in this particular payload) fixes that.
  //
  // Unlike Tripay's callback, GensPay's transaction.updated event doesn't
  // reliably carry these amount fields in every deployment -- when
  // present we still cross-check (catches gateway-side bugs crediting the
  // wrong amount), but we don't hard-require the field the way the Tripay
  // version did, since order_id itself is only trustworthy because the
  // whole payload is HMAC-verified above.
  const settledAmount =
    typeof payload.data?.net_amount === "number" ? payload.data.net_amount : payload.data?.amount;
  if (typeof settledAmount === "number" && settledAmount !== nominal) {
    console.error(
      `Topup webhook amount mismatch: order_id nominal=${nominal} settledAmount=${settledAmount} (raw amount=${payload.data?.amount}, net_amount=${payload.data?.net_amount})`
    );
    return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
  }

  // FIX: settle_topup's real signature (0006_reseller_ops.sql) only takes
  // 4 params -- p_provider_ref, p_user_id, p_nominal, p_bonus. The old
  // call here also passed p_merchant_ref, which the function doesn't
  // declare; PostgREST rejects RPC calls with an unrecognized named
  // param (schema-cache lookup failure), so every real settlement would
  // have failed here even once the order_id-length issue above was fixed.
  // `admin` is reused from the pending-row lookup above -- no need for a
  // second client.
  const { data, error } = await admin.rpc("settle_topup", {
    p_provider_ref: orderId,
    p_user_id: userId,
    p_nominal: nominal,
    p_bonus: bonus,
  });

  if (error) {
    return NextResponse.json({ error: "settle_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, topup: data });
}

