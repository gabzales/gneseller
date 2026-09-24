export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Whether real Supabase credentials are configured. Every data-reading
 * page/route checks this and falls back to `src/lib/mock-data.ts` when
 * false, so `npm run build` / `npm run dev` always work out of the box —
 * even before a Supabase project exists — without throwing at runtime.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
