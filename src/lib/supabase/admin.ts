import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * Privileged client — bypasses RLS entirely via the service_role key.
 * ONLY import this from Route Handlers under src/app/api/**, never from
 * a component. Used for the two mutations that must never be
 * client-writable: debiting balance on key generation, and crediting
 * balance from the QRIS webhook (see supabase/migrations/0001_init.sql,
 * functions generate_key / settle_topup).
 *
 * FIX (Sep 2026): supabase-js talks to PostgREST over plain fetch()
 * internally, and Next.js patches global fetch to auto-cache requests
 * during rendering. `export const dynamic = 'force-dynamic'` on a page
 * stops that PAGE from being statically cached, but it does NOT
 * automatically add `cache: 'no-store'` to every fetch() call inside
 * it -- individual fetch() calls (including the ones supabase-js makes
 * for us, which we never see or control directly) still default to
 * being cacheable. Confirmed as a real, persistent bug: reseller price
 * tiers on /dashboard/generate stayed stale even AFTER force-dynamic
 * was deployed and verified present in the built file.
 *
 * Fix: pass a custom `fetch` into the Supabase client that forces
 * `cache: 'no-store'` on EVERY request this client makes, at the
 * source -- this makes every route/page using createAdminSupabase()
 * immune to this class of bug going forward, not just the one page
 * where it was noticed.
 */
function noStoreFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, cache: "no-store" });
}

export function createAdminSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceKey) return null;
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: noStoreFetch },
  });
}
