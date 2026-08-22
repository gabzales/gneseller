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
 */
export function createAdminSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceKey) return null;
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
