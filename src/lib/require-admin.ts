import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ResellerUser } from "@/lib/types";

/**
 * Resolves the signed-in user AND confirms role === 'admin' by reading
 * their own row (RLS policy "users read own row" already allows this with
 * the anon-key, cookie-bound client -- no service role needed here).
 *
 * Every /dashboard/admin/** page and /api/admin/** route calls this
 * itself rather than relying solely on middleware.ts -- defense in depth,
 * same reasoning as isSameOriginRequest() in src/lib/origin-guard.ts.
 */
export async function getAdminUser(): Promise<ResellerUser | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, avatar_url, balance, role, verified")
    .eq("id", user.id)
    .single();

  if (error || !data || data.role !== "admin") return null;

  return {
    id: data.id,
    name: data.full_name || data.email,
    email: data.email,
    avatarSeed: data.avatar_url || data.id,
    balance: data.balance,
    role: data.role,
    verified: data.verified,
  };
}
