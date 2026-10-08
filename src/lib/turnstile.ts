import "server-only";

/**
 * Verifikasi token Cloudflare Turnstile di server.
 * - TURNSTILE_SECRET_KEY kosong  -> verifikasi dilewati (fitur dimatikan).
 * - Gagal menghubungi Cloudflare -> DITOLAK (fail closed) supaya tidak bisa dibypass.
 */
export async function verifyTurnstile(token: unknown, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] verify failed:", err);
    return false;
  }
}
