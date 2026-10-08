import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * Shared guard for /api/debug/* and /api/setup-admin.
 *
 * - Secret is read from the `x-debug-secret` header (preferred: headers are
 *   not written to access logs / browser history / Referer) and, for
 *   backwards compatibility with existing bookmarks, from `?secret=`.
 * - Comparison is constant-time (both sides hashed to 32 bytes first, so
 *   length differences don't leak either).
 * - Every response goes through noStoreJson() so nothing is cached by the
 *   browser, a CDN or a proxy.
 */
const NO_STORE = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" };

export function noStoreJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, { status: init?.status, headers: NO_STORE });
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function providedSecret(request: Request): string {
  const header = request.headers.get("x-debug-secret");
  if (header) return header.trim();
  return new URL(request.url).searchParams.get("secret") ?? "";
}

export function debugSecretFromEnv(): string {
  return (process.env.GENSPAY_DEBUG_SECRET || process.env.SETUP_ADMIN_SECRET || "").trim();
}

/** Returns null when authorised, otherwise the response to send back. */
export function guardWithSecret(request: Request, expected: string, notConfiguredMessage?: string) {
  if (!expected) {
    return noStoreJson(
      { error: "not_configured", message: notConfiguredMessage },
      { status: 503 }
    );
  }
  const provided = providedSecret(request);
  if (!provided || !safeEqual(provided, expected)) {
    return noStoreJson({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export function guardDebug(request: Request, notConfiguredMessage?: string) {
  return guardWithSecret(request, debugSecretFromEnv(), notConfiguredMessage);
}
