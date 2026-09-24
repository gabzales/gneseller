import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isSameOriginRequest } from "@/lib/origin-guard";
import { THEMES } from "@/lib/theme";

/**
 * Saves the caller's chosen palette to their OWN account row
 * (public.users.theme), so it follows them across devices instead of
 * only living in this browser's localStorage.
 *
 * Uses the regular session-scoped client (not the service-role admin
 * client) -- theme is a harmless, non-financial preference, so it goes
 * through the same self-update RLS policy/column grant as full_name and
 * avatar_url (see 0001_init.sql + 0009_theme_per_account.sql), not
 * through a SECURITY DEFINER RPC the way balance-affecting writes must.
 */
export async function PUT(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const themeId = typeof body?.themeId === "string" ? body.themeId : null;

  // Reject anything not in the known theme list rather than trusting the
  // client -- avoids storing garbage that getTheme()'s fallback would
  // just silently mask later anyway, but better to catch it here.
  if (!themeId || !THEMES.some((t) => t.id === themeId)) {
    return NextResponse.json({ error: "invalid_theme" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!user || !supabase) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("users").update({ theme: themeId }).eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: "save_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, theme: themeId });
}
