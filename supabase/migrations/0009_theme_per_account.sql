-- FEATURE: theme (color palette) preference is now stored per-ACCOUNT,
-- not just per-device localStorage. Previously ThemeSwitcher.tsx only
-- ever wrote to localStorage (see ThemeProvider.tsx) -- switching
-- devices, or a fresh browser profile, always fell back to
-- DEFAULT_THEME with no memory of what the account had picked before.
--
-- theme is intentionally NOT constrained with a foreign-key-style enum
-- against a THEMES table -- the valid set lives in src/lib/theme.ts
-- (THEMES array) and can grow over time without a migration. A CHECK
-- constraint against a hardcoded list would need updating every time a
-- theme is added there, so validation instead happens in
-- getTheme()/ThemeProvider (falls back to DEFAULT_THEME for anything
-- unrecognized) -- same graceful-fallback approach already used for an
-- invalid/stale localStorage value.
alter table public.users
  add column if not exists theme text not null default 'ghost';

-- Same self-update pattern as full_name/avatar_url (0001_init.sql):
-- users may change their OWN theme, nothing else, never balance/role/
-- verified. Widening this grant to include theme (rather than a
-- separate policy) keeps the "only these fields are user-writable"
-- comment in 0001 accurate in one place.
grant update (full_name, avatar_url, theme) on public.users to authenticated;
-- The existing "users update own non-balance fields" policy
-- (auth.uid() = id, both using + with check) already covers this new
-- column automatically -- RLS policies apply per-row, not per-column,
-- so no new policy is needed, only the wider column grant above.
