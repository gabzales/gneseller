import { maskSecret } from "@/lib/mask-secret";
import { guardDebug, noStoreJson } from "@/lib/debug-auth";
import { getGenspayConfig, testGenspayConnection } from "@/lib/provider/genspay";

/**
 * Browser-openable GensPay debug endpoint, protected by a shared secret
 * (same pattern as /api/setup-admin) -- NOT the admin dashboard's
 * Test & Debug button, on purpose:
 *
 *   - Doesn't require a logged-in admin session, so it still works even
 *     if login/cookies/session itself is the thing broken.
 *   - Plain GET -- open the URL in any browser, no curl/Postman needed.
 *   - Prints the FULL resolved config (base URL + masked key, and where
 *     each came from: DB app_settings vs env var) BEFORE even attempting
 *     the GensPay call, so a misconfigured Vercel env var or an empty DB
 *     row shows up immediately instead of masquerading as a GensPay-side
 *     rejection.
 *
 * Usage:
 *   https://yourdomain.com/api/debug/genspay?secret=YOUR_DEBUG_SECRET
 *
 * Setup: add GENSPAY_DEBUG_SECRET to Vercel env vars (any random string),
 * redeploy. Without it set, this endpoint always 503s -- it will never
 * silently run unprotected.
 *
 * ⚠️ Same caution as /api/setup-admin: whoever knows the secret can hit
 * this and see a masked API key + trigger a real (throwaway, Rp 1.000)
 * test transaction against your live GensPay account. Remove this route
 * or rotate GENSPAY_DEBUG_SECRET once you're done debugging.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const denied = guardDebug(request, "Isi GENSPAY_DEBUG_SECRET atau SETUP_ADMIN_SECRET di Vercel, redeploy, baru buka URL ini lagi.");
  if (denied) return denied;

  // Step 1: what config does the server actually resolve, right now, in
  // THIS deployment -- before any network call. This is the single most
  // common root cause: Vercel env var typo'd/missing, or DB app_settings
  // row saved with a stale/wrong value overriding a correct env var.
  const { apiKey, baseUrl } = await getGenspayConfig();
  const resolvedFrom = {
    // We can't cheaply tell DB vs env apart post-merge without touching
    // getGenspayConfig's internals, so surface both raw sources
    // side-by-side instead -- just as diagnostic, arguably clearer.
    envApiKeySet: Boolean(process.env.GENSPAY_API_KEY),
    envBaseUrl: process.env.GENSPAY_BASE_URL || null,
    resolvedBaseUrl: baseUrl,
    resolvedApiKeyMasked: apiKey ? maskSecret(apiKey) : null,
    resolvedApiKeyLength: apiKey.length,
  };

  // Step 2: skip the fetch entirely if either half is missing -- avoids a
  // confusing "gateway rejected" step-2 failure when the real problem is
  // step 1 (nothing configured at all).
  if (!apiKey || !baseUrl) {
    return noStoreJson({
      ok: false,
      config: resolvedFrom,
      message:
        "API Key atau Base URL kosong -- request ke GensPay belum sempat dicoba. Isi GENSPAY_API_KEY/GENSPAY_BASE_URL di Vercel env vars (redeploy setelahnya), atau lewat /dashboard/admin/settings/genspay.",
    });
  }

  // Step 3: the real call. Default mode mirrors the admin dashboard's
  // "Test & Debug" button exactly (short order_id, amount 1000).
  //
  // ?realistic=1 instead builds a FAKE order_id in production's exact
  // shape -- "topup-<uuid>-<nominal>-<nonce>", same length a real user_id
  // UUID produces (topup/create/route.ts) -- to isolate whether GensPay's
  // "Validation failed" is actually about order_id length/character
  // count rather than amount. The debug test's short order_id (~19 chars)
  // succeeding while real checkout's long one (~58-60 chars) fails would
  // point straight at an order_id length limit on GensPay's side.
  const realistic = searchParams.get("realistic") === "1";
  const fakeOrderId = realistic
    ? `topup-${crypto.randomUUID()}-${searchParams.get("nominal") || "100000"}-${Math.random().toString(16).slice(2, 10)}`
    : undefined;

  const result = await testGenspayConnection(fakeOrderId);

  return noStoreJson({
    ...result,
    config: resolvedFrom,
  });
}
