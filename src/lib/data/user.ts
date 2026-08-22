import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { CURRENT_USER } from "@/lib/mock-data";
import { ResellerUser } from "@/lib/types";

/**
 * Resolves the signed-in user for the current request.
 * - Supabase configured + no session  -> null (caller should redirect;
 *   middleware already does this for everything under /dashboard).
 * - Supabase configured + session     -> real row from `public.users`.
 * - Supabase NOT configured           -> the mock demo user, so every
 *   page keeps working before a project is wired up.
 *
 * Wrapped in React's `cache()` so the layout and each page can both call
 * this without issuing duplicate Supabase requests per render pass.
 */
export const getCurrentUser = cache(async (): Promise<ResellerUser | null> => {
  if (!isSupabaseConfigured) return CURRENT_USER;

  const supabase = await createServerSupabase();
  if (!supabase) return CURRENT_USER;

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data } = await supabase
    .from("users")
    .select("id, full_name, email, avatar_url, balance, role, verified, theme")
    .eq("id", authUser.id)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    name: data.full_name || data.email.split("@")[0],
    email: data.email,
    avatarSeed: data.id,
    balance: data.balance,
    role: data.role,
    verified: data.verified,
    theme: data.theme || "ghost",
  };
});
