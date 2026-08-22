import "server-only";

/**
 * Defense-in-depth CSRF check for cookie-authenticated, state-changing
 * route handlers (balance debit/credit endpoints). Supabase's session
 * cookie is already SameSite=Lax, which blocks the classic cross-site
 * <form> POST vector on its own — this adds a second, independent check
 * so the endpoint doesn't rely on cookie attributes alone.
 *
 * Not applied to /api/webhooks/**: those are called server-to-server by
 * the payment gateway (no browser Origin header at all) and are
 * authenticated by HMAC signature instead.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  // Same-origin fetch() calls always send an Origin header for POST; a
  // missing header here means a non-browser client or a same-origin
  // server action, neither of which this check needs to block.
  if (!origin) return true;

  const host = request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
