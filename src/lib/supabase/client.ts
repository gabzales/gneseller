"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./config";

/**
 * Client-side Supabase instance. Only call this where
 * `isSupabaseConfigured` is true — components that need it should check
 * the flag first and render a "belum terhubung" state otherwise (see
 * src/components/LoginForm.tsx for the pattern).
 */
export function createClient() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase belum dikonfigurasi — isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local"
    );
  }
  return createBrowserClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string);
}
