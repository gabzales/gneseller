import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";

// ══════════════════════════════════════════════════════════════════
// GensPay QRIS gateway config -- same DB-first / env-fallback pattern
// as src/lib/provider/vipibmstore.ts, so credentials can be set from
// /dashboard/admin/settings/genspay without a redeploy, same as the
// Reseller API ones already are.
//
// Kredensial diambil dari (urutan prioritas):
//   1. app_settings row 'genspay' -- diisi admin lewat panel.
//   2. Env var GENSPAY_BASE_URL / GENSPAY_API_KEY (.env.example).
//
// src/app/api/topup/create/route.ts dan src/app/api/webhooks/topup/route.ts
// memanggil getGenspayConfig() ini, bukan process.env langsung, supaya
// keduanya otomatis ikut config yang disimpan admin di panel.
// ══════════════════════════════════════════════════════════════════

const DEFAULT_BASE_URL = "https://genspay.my.id/api/v1";

export type GenspayConfig = { apiKey: string; baseUrl: string };

const CONFIG_CACHE_TTL_MS = 30_000;
let cachedConfig: GenspayConfig | null = null;
let cachedAt = 0;

export async function getGenspayConfig(): Promise<GenspayConfig> {
  // FIX: this used to cache forever (no TTL) in a module-level variable.
  // On Vercel, every serverless instance has its OWN copy of that
  // variable -- there could easily be 5-10+ warm instances handling
  // /api/topup/create and /api/webhooks/topup concurrently. If the API
  // key was ever changed via /dashboard/admin/settings/genspay,
  // invalidateGenspayConfigCache() only clears the cache in the ONE
  // instance that handled that save request; every other already-warm
  // instance kept serving the OLD key indefinitely (until it happened to
  // cold-start again, which can be hours/days later on a busy site).
  //
  // Concretely: if the webhook handler in api/webhooks/topup/route.ts
  // lands on one of those stale instances, verifySignature() computes
  // SHA256(rawBody + STALE_KEY) -- which will never match the signature
  // GensPay actually sent (computed with the real, current key) -- and
  // silently returns 401 with no error visible anywhere except a Vercel
  // log line nobody's watching. This produces exactly the "sometimes it
  // works, sometimes the same payment just never credits, no pattern"
  // symptom, because which instance picks up which request is effectively
  // random from our side.
  //
  // A 30s TTL means every instance self-heals within 30 seconds of a key
  // change, at the cost of one extra DB read per 30s window per instance
  // -- negligible compared to correctness here.
  if (cachedConfig && Date.now() - cachedAt < CONFIG_CACHE_TTL_MS) {
    return cachedConfig;
  }

  let stored: Partial<GenspayConfig> = {};
  const admin = createAdminSupabase();
  if (admin) {
    const { data } = await admin.from("app_settings").select("value").eq("key", "genspay").maybeSingle();
    if (data?.value) stored = data.value as Partial<GenspayConfig>;
  }

  const config: GenspayConfig = {
    apiKey: (stored.apiKey || process.env.GENSPAY_API_KEY || "").trim(),
    baseUrl: (stored.baseUrl || process.env.GENSPAY_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, ""),
  };
  cachedConfig = config;
  cachedAt = Date.now();
  return config;
}

/** Call after saving new credentials so the next request re-reads them
 *  (still only clears THIS instance's cache -- see the TTL comment above
 *  for why that's no longer the only thing standing between a key change
 *  and every instance picking it up). */
export function invalidateGenspayConfigCache() {
  cachedConfig = null;
  cachedAt = 0;
}

export async function isGenspayConfigured(): Promise<boolean> {
  const { apiKey, baseUrl } = await getGenspayConfig();
  return Boolean(apiKey && baseUrl);
}

export type GenspayTestStep = {
  step: string;
  ok: boolean;
  detail: string;
};

export type GenspayTestResult = {
  ok: boolean;
  steps: GenspayTestStep[];
  httpStatus?: number;
  elapsedMs?: number;
  rawResponse?: string;
};

/**
 * Diagnostic "test connection" call, for the admin panel's Test/Debug
 * button. GensPay has no dedicated ping/health endpoint in the docs, so
 * this exercises the real POST /transaction/create path with the
 * smallest valid amount (Rp 1.000, GensPay's documented minimum) and a
 * throwaway order_id -- the same request shape production checkout
 * uses, just with a test-* prefix so it's easy to spot in the GensPay
 * dashboard. This is the only way to actually prove: base URL resolves,
 * API key is accepted (401 vs 201), and the response shape matches what
 * src/app/api/topup/create/route.ts expects.
 *
 * Every failure path is captured as its own step with the raw detail
 * GensPay returned, rather than collapsing everything into one generic
 * "gagal" -- that's the "sampe ke akar-akarnya" part.
 */
export async function testGenspayConnection(orderIdOverride?: string): Promise<GenspayTestResult> {
  const steps: GenspayTestStep[] = [];
  const { apiKey, baseUrl } = await getGenspayConfig();

  steps.push({
    step: "config",
    ok: Boolean(apiKey && baseUrl),
    detail: apiKey && baseUrl ? `Base URL: ${baseUrl}` : "API Key atau Base URL kosong.",
  });
  if (!apiKey || !baseUrl) {
    return { ok: false, steps };
  }

  let url: URL;
  try {
    url = new URL(baseUrl.replace(/\/+$/, "") + "/transaction/create");
    steps.push({ step: "url_parse", ok: true, detail: url.toString() });
  } catch (e) {
    steps.push({ step: "url_parse", ok: false, detail: `Base URL tidak valid: ${(e as Error).message}` });
    return { ok: false, steps };
  }

  const orderId = orderIdOverride ?? `test-diag-${Date.now().toString(36)}`;
  steps.push({ step: "order_id", ok: true, detail: `"${orderId}" (${orderId.length} karakter)` });
  const appUrl = (process.env.APP_URL || "https://ghostseller.my.id").replace(/\/+$/, "");
  const callbackUrl = `${appUrl}/api/webhooks/topup`;
  steps.push({ step: "callback_url", ok: true, detail: callbackUrl });
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ amount: 1000, order_id: orderId, payment_method: "qris", callback_url: callbackUrl }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "TimeoutError";
    steps.push({
      step: "request",
      ok: false,
      detail: aborted
        ? "Timeout menghubungi GensPay (>15s) -- cek Base URL/koneksi jaringan."
        : `Gagal konek ke GensPay: ${(e as Error).message}`,
    });
    return { ok: false, steps, elapsedMs: Date.now() - started };
  }

  const elapsedMs = Date.now() - started;
  const rawText = await res.text().catch(() => "");
  steps.push({ step: "request", ok: true, detail: `HTTP ${res.status} dalam ${elapsedMs}ms` });

  let parsed: { success?: boolean; error?: string; data?: { qr_string?: string } } | null = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
    steps.push({ step: "parse_json", ok: true, detail: "Response valid JSON." });
  } catch {
    steps.push({
      step: "parse_json",
      ok: false,
      detail: "Response BUKAN JSON valid -- kemungkinan Base URL salah / kena halaman HTML (404, proxy, dsb).",
    });
    return { ok: false, steps, httpStatus: res.status, elapsedMs, rawResponse: rawText.slice(0, 500) };
  }

  if (res.status === 401) {
    steps.push({
      step: "auth",
      ok: false,
      detail: parsed?.error || "API Key ditolak (401) -- cek ulang GENSPAY_API_KEY.",
    });
    return { ok: false, steps, httpStatus: res.status, elapsedMs, rawResponse: rawText.slice(0, 500) };
  }

  if (res.status === 201 && parsed?.success && parsed.data?.qr_string) {
    steps.push({
      step: "auth",
      ok: true,
      detail: "API Key diterima, transaksi test berhasil dibuat (qr_string diterima).",
    });
    steps.push({
      step: "note",
      ok: true,
      detail: `Transaksi test order_id=${orderId} akan otomatis EXPIRED di GensPay (tidak dibayar) -- aman diabaikan.`,
    });
    return { ok: true, steps, httpStatus: res.status, elapsedMs, rawResponse: rawText.slice(0, 500) };
  }

  // Any other status (400/409/503/etc): key + base URL are reachable,
  // but something else is off -- surface GensPay's own error message
  // verbatim so the admin can act on the real root cause instead of a
  // generic "gagal".
  steps.push({
    step: "response",
    ok: false,
    detail: parsed?.error
      ? `GensPay menolak request: ${parsed.error} (HTTP ${res.status})`
      : `Response tidak sesuai kontrak yang diharapkan (HTTP ${res.status}).`,
  });
  return { ok: false, steps, httpStatus: res.status, elapsedMs, rawResponse: rawText.slice(0, 500) };
}
