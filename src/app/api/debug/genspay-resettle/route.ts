import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getGenspayConfig } from "@/lib/provider/genspay";
import { POST as webhookHandler } from "@/app/api/webhooks/topup/route";

/**
 * Proves -- doesn't guess -- whether /api/webhooks/topup's own code is
 * correct, by building a real, correctly-signed "transaction.updated"
 * payload (identical shape/signature scheme to what GensPay actually
 * sends) for a REAL stuck merchant_ref, and calling the real webhook
 * handler function directly (not a copy, not a mock -- the literal same
 * POST() this file imports from src/app/api/webhooks/topup/route.ts).
 *
 * This sidesteps the one thing we can't verify from in here: whether
 * GensPay's servers actually deliver the callback at all. If this
 * self-test succeeds and credits the balance, the webhook CODE is
 * proven correct end-to-end -- the remaining problem can only be
 * delivery (GensPay not calling us, or a network/WAF layer between
 * GensPay and Vercel dropping it), not application logic. If it fails,
 * the error returned here is a real, reproducible bug to fix.
 *
 * Usage: GET /api/debug/genspay-resettle?secret=X&merchant_ref=topup-xxxx
 * merchant_ref = the exact order_id/merchant_ref of the stuck "Menunggu"
 * row (visible in Supabase topups table or the customer's top-up
 * history entry).
 *
 * Safe to call more than once on an already-settled row -- settle_topup
 * is idempotent (checks provider_ref before inserting), and this route's
 * own webhook lookup only acts on rows still in 'pending' status.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const debugSecret = process.env.GENSPAY_DEBUG_SECRET;
  const provided = searchParams.get("secret");
  if (!debugSecret) {
    return NextResponse.json({ error: "not_configured", message: "GENSPAY_DEBUG_SECRET belum diisi." }, { status: 503 });
  }
  if (!provided || provided !== debugSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const merchantRef = searchParams.get("merchant_ref");
  if (!merchantRef) {
    return NextResponse.json({ error: "missing_merchant_ref", message: "Tambahkan ?merchant_ref=topup-xxxx dari row yang macet 'Menunggu'." }, { status: 400 });
  }

  const { apiKey } = await getGenspayConfig();
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key", message: "GENSPAY_API_KEY/app_settings kosong -- signature tidak bisa dibangun." }, { status: 500 });
  }

  // Bentuk PERSIS payload yang GensPay kirim beneran (lihat docstring di
  // src/app/api/webhooks/topup/route.ts) -- event selalu "transaction.updated",
  // status uppercase "SUCCESS".
  const body = JSON.stringify({
    event: "transaction.updated",
    data: { order_id: merchantRef, status: "SUCCESS" },
    timestamp: new Date().toISOString(),
  });
  const signature = createHash("sha256").update(body + apiKey).digest("hex");

  // Panggil handler ASLI langsung -- bukan tiruan, bukan fetch ke URL
  // eksternal yang bisa gagal karena alasan lain (DNS, self-fetch
  // blocked, dst). Ini benar-benar menjalankan kode webhook yang sama
  // persis yang akan jalan kalau GensPay yang manggil.
  const fakeRequest = new Request(new URL(request.url).origin + "/api/webhooks/topup", {
    method: "POST",
    headers: { "x-genspay-signature": signature, "content-type": "application/json" },
    body,
  });

  let result: unknown;
  let status: number;
  try {
    const res = await webhookHandler(fakeRequest);
    status = res.status;
    result = await res.json().catch(() => null);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "handler_threw", message: (e as Error).message, stack: (e as Error).stack },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: status >= 200 && status < 300,
    simulatedWebhookHttpStatus: status,
    simulatedWebhookResponse: result,
    note:
      status >= 200 && status < 300
        ? "Webhook code berhasil settle. Kalau saldo customer sekarang beneran nambah, kode webhook TERBUKTI benar -- sisa masalahnya di pengiriman dari GensPay (registrasi webhook URL / jaringan), bukan bug aplikasi."
        : "Webhook code gagal -- ini bug beneran yang reproducible, kirim response ini biar bisa langsung dikejar.",
  });
}
