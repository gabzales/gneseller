import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getStenlyConfig, verifyStenlySignature } from "@/lib/provider/stenly";

/**
 * stenly.id QRIS webhook handler (see src/app/api/topup/create/route.ts,
 * which now branches to stenly.id's createStenlyCharge() when
 * payment_gateway.active === "stenly").
 *
 * Contract per stenly.id's official docs (stenly.id/docs):
 *   headers: {
 *     "X-Stenly-Signature": hex HMAC-SHA256(rawBody, Webhook Secret),
 *     "X-Stenly-Event": "payment.status_updated"
 *   }
 *   body: {
 *     event: "payment.status_updated",
 *     project_id: number,
 *     data: {
 *       order_id: string,
 *       gross_amount: number,
 *       status: "paid" | "expired" | "cancelled",
 *       payment_method: "qris",
 *       paid_at?: string,
 *       journal_id?: string
 *     },
 *     timestamp: number
 *   }
 *
 * IMPORTANT: signature is HMAC-SHA256 (crypto.createHmac), using the
 * separate Webhook Secret (whsec_...) -- NOT plain SHA256(body+secret)
 * like GensPay, and NOT the Secret Key (sk_...) used for normal API auth.
 * Mixing these up (like GensPay's plain-SHA256 scheme, or GensPay's own
 * apiKey) will make every real callback fail verification.
 *
 * Docs require HTTP 200 with body {"received": true} within 10 seconds.
 * "Retry otomatis belum tersedia" per docs -- unlike GensPay's 5x retry,
 * there's no safety net if this handler is slow/down, which is exactly
 * why maxDuration is set generously here too and every branch below
 * still returns fast.
 */
export const maxDuration = 30;

async function logWebhook(
  admin: ReturnType<typeof createAdminSupabase>,
  result: string,
  orderId: string | null,
  detail?: Record<string, unknown>
) {
  if (!admin) return;
  try {
    await admin.from("webhook_log").insert({ provider: "stenly", result, order_id: orderId, detail: detail ?? null });
  } catch {
    // best-effort only, same as the GensPay webhook
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }
  const admin = createAdminSupabase();

  const rawBody = await request.text();
  const signature = request.headers.get("x-stenly-signature");

  const { webhookSecret } = await getStenlyConfig();
  if (!verifyStenlySignature(rawBody, signature, webhookSecret)) {
    await logWebhook(admin, "signature_invalid", null, { rawBodyPreview: rawBody.slice(0, 200), hadSignatureHeader: Boolean(signature) });
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: {
    event?: string;
    data?: { order_id?: string; gross_amount?: number; status?: string };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await logWebhook(admin, "bad_payload", null, { reason: "invalid_json", rawBodyPreview: rawBody.slice(0, 200) });
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (payload.event !== "payment.status_updated") {
    await logWebhook(admin, "ignored_event", payload.data?.order_id ?? null, { event: payload.event ?? "unknown" });
    return NextResponse.json({ received: true, ignored: payload.event ?? "unknown" });
  }

  const orderId = payload.data?.order_id;
  if (typeof orderId !== "string") {
    await logWebhook(admin, "bad_payload", null, { reason: "missing_order_id", payload });
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }

  if (!admin) {
    return NextResponse.json({ error: "service_role_missing" }, { status: 500 });
  }

  // Same idempotent-settlement pattern as the GensPay webhook: the pending
  // row (inserted at checkout by topup/create/route.ts, keyed by
  // merchant_ref = order_id) is the source of truth for user_id/nominal/
  // bonus -- never trust those from the webhook payload directly.
  const { data: pending, error: pendingLookupError } = await admin
    .from("topups")
    .select("user_id, nominal, bonus")
    .eq("merchant_ref", orderId)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingLookupError) {
    await logWebhook(admin, "error", orderId, { stage: "pending_lookup", message: pendingLookupError.message });
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!pending) {
    await logWebhook(admin, "no_pending_row", orderId);
    return NextResponse.json({ received: true, ignored: "no_pending_row" });
  }
  const userId = pending.user_id as string;
  const nominal = pending.nominal as number;
  const bonus = pending.bonus as number;

  if (payload.data?.status !== "paid") {
    // "expired" / "cancelled" -- nothing to credit.
    await logWebhook(admin, "not_paid_status", orderId, { status: payload.data?.status ?? "unknown" });
    return NextResponse.json({ received: true, ignored: payload.data?.status ?? "unknown_status" });
  }

  // stenly.id's gross_amount on the webhook is the SAME nominal we
  // requested at create-charge time (docs show no separate fee/net_amount
  // split the way GensPay does) -- cross-check directly against `nominal`.
  if (typeof payload.data?.gross_amount === "number" && payload.data.gross_amount !== nominal) {
    await logWebhook(admin, "amount_mismatch", orderId, { nominal, grossAmount: payload.data.gross_amount });
    return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
  }

  const { data, error } = await admin.rpc("settle_topup", {
    p_provider_ref: orderId,
    p_user_id: userId,
    p_nominal: nominal,
    p_bonus: bonus,
  });

  if (error) {
    await logWebhook(admin, "error", orderId, { stage: "settle_topup", message: error.message });
    return NextResponse.json({ error: "settle_failed", message: error.message }, { status: 500 });
  }

  await logWebhook(admin, "settled", orderId, { userId, nominal, bonus });
  return NextResponse.json({ received: true, topup: data });
}
