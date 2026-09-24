/** @type {import('next').NextConfig} */

// Baseline security headers for production.
//
// script-src intentionally includes 'unsafe-inline': Next.js 14's App
// Router (self-hosted, no CDN/edge nonce plumbing) injects inline
// hydration/RSC bootstrap scripts that a strict nonce-based CSP would
// need per-request middleware wiring to allow -- tested against this
// exact Next 14.2.35 build and the automatic nonce propagation documented
// for newer/Vercel-hosted setups did not tag those scripts here, so a
// nonce-only policy blocked the app from rendering at all. 'self' still
// blocks loading any *external* script (the more common XSS payload --
// injecting a <script src="https://attacker.example/x.js">), which is
// the main thing this header buys you when self-hosting like this.
// Revisit if/when this app moves to Next 15+ with proper nonce support.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://genspay.my.id",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
