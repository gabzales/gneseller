import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Without a configured project there's nothing to authenticate against --
  // let every route through so the UI stays browsable on mock data.
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
  const isAdminRoute = request.nextUrl.pathname.startsWith("/dashboard/admin");

  if (isDashboardRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Banned reseller check -- a banned account's session token can still
  // be valid (banning doesn't revoke existing sessions), so this is the
  // gate that actually stops them from using the dashboard. Signs them
  // out entirely rather than just redirecting, so a stale session can't
  // keep retrying. RPCs (generate_key, settle_topup, etc.) also check
  // this independently server-side -- see assert_not_banned() in
  // 0006_reseller_ops.sql -- since middleware alone is not enough for
  // state-changing calls made outside a full page navigation.
  if (isDashboardRoute && user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role, banned")
      .eq("id", user.id)
      .single();

    if (profile?.banned) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("banned", "1");
      return NextResponse.redirect(url);
    }

    // Admin authority check -- separate from the checks above, so a
    // logged-in non-admin gets bounced to /dashboard instead of /login.
    // Full defense in depth: /dashboard/admin/layout.tsx and every
    // /api/admin/** route re-check this themselves via getAdminUser()
    // rather than trusting the middleware alone.
    if (isAdminRoute && profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
