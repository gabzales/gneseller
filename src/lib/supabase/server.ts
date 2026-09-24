import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./config";

// Sama alasannya kayak di admin.ts: cegah fetch() internal supabase-js
// ke-cache Next.js/Vercel terlepas dari dynamic rendering status halaman
// yang makai client ini.
function noStoreFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, cache: "no-store" });
}

/**
 * Server Component / Route Handler client — reads/writes the auth cookie
 * for the current request. Use this (never the service-role client) for
 * anything that should respect the signed-in user's RLS policies.
 */
export async function createServerSupabase() {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component render — middleware refreshes
          // the session instead, so this can be safely ignored.
        }
      },
    },
    global: { fetch: noStoreFetch },
  });
}
