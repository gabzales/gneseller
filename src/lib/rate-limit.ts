import "server-only";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sliding-window rate limit backed by the `check_rate_limit` Postgres RPC
 * (see supabase/migrations/0002_production_hardening.sql). Call this with
 * the ADMIN (service-role) client from a route handler, never from the
 * client — the underlying table has no grants for anon/authenticated at
 * all.
 *
 * Fails OPEN on unexpected RPC errors (logs and lets the request through)
 * so a rate-limit outage never becomes a full outage of the endpoint it
 * protects — the endpoint's own auth/RLS checks still apply regardless.
 */
export async function checkRateLimit(
  admin: SupabaseClient,
  bucket: string,
  { maxHits, windowSeconds }: { maxHits: number; windowSeconds: number }
): Promise<boolean> {
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_bucket: bucket,
    p_max_hits: maxHits,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("check_rate_limit failed, allowing request through:", error.message);
    return true;
  }

  return Boolean(data);
}
