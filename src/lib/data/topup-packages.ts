import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { TOPUP_PACKAGES as MOCK_TOPUP_PACKAGES } from "@/lib/mock-data";

export type TopupPackage = { nominal: number; bonus: number };

/**
 * Reads active topup packages from `public.topup_packages` (0006
 * migration) so admin can edit nominal/bonus from the panel instead of
 * redeploying. Falls back to the hardcoded TOPUP_PACKAGES in mock-data.ts
 * when Supabase isn't configured OR the table is empty/unreachable --
 * this keeps the Top Up page functional even before 0006 has been run.
 *
 * Used by BOTH the reseller-facing /dashboard/topup page (via the anon/
 * authenticated client, cookie-bound to the request) and, with the admin
 * client, by /api/topup/create for server-side validation of the
 * requested nominal.
 */
export async function getTopupPackages(): Promise<TopupPackage[]> {
  if (!isSupabaseConfigured) return MOCK_TOPUP_PACKAGES;

  const supabase = await createServerSupabase();
  if (!supabase) return MOCK_TOPUP_PACKAGES;

  const { data, error } = await supabase
    .from("topup_packages")
    .select("nominal, bonus")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) return MOCK_TOPUP_PACKAGES;

  return data.map((p) => ({ nominal: p.nominal, bonus: p.bonus }));
}

/**
 * Same as above but via the service-role client -- used from Route
 * Handlers (like /api/topup/create) that already hold the admin client
 * for other calls, so we don't spin up a second cookie-bound client just
 * to read a public catalog table.
 */
export async function getTopupPackagesAsAdmin(): Promise<TopupPackage[]> {
  if (!isSupabaseConfigured) return MOCK_TOPUP_PACKAGES;

  const admin = createAdminSupabase();
  if (!admin) return MOCK_TOPUP_PACKAGES;

  const { data, error } = await admin
    .from("topup_packages")
    .select("nominal, bonus")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) return MOCK_TOPUP_PACKAGES;

  return data.map((p) => ({ nominal: p.nominal, bonus: p.bonus }));
}
