import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";

// ══════════════════════════════════════════════════════════════════
// Partner API (server-to-server) config -- dipakai oleh
// /api/v1/partner/** supaya toko client lain (misal RYAN NEW ERA)
// bisa auto-restock key dari GhostSeller TANPA login/cookie session
// (beda dari /api/generate-key yang pakai session Supabase Auth).
//
// Kredensial (X-API-Key) & akun reseller yang dipakai untuk menagih
// balance diambil dari (urutan prioritas), sama seperti pola
// genspay.ts / vipibmstore.ts:
//   1. app_settings row 'partner_api' -- diisi admin lewat panel
//      (/dashboard/admin/settings/partner-api).
//   2. Env var PARTNER_API_KEY / PARTNER_API_RESELLER_ID (fallback).
//
// resellerId WAJIB menunjuk ke satu akun reseller (public.users, role
// 'user') yang sengaja dibuat admin sebagai "akun partner" untuk toko
// client tsb -- semua key yang di-generate lewat partner API akan
// memotong balance akun ini, sama seperti reseller biasa. Ini supaya
// pemakaian tetap tercatat & dibatasi saldo, bukan generate gratis
// tanpa batas.
//
// CATATAN: sengaja TIDAK di-cache di module-level (beda dari pola TTL
// 30 detik di genspay.ts). getPartnerApiConfig() dipanggil dari 3 route
// API berbeda (/admin/settings/partner-api, /api/v1/partner/products,
// /api/v1/partner/generate-key) yang di Vercel jadi serverless function
// TERPISAH dengan module scope masing-masing -- cache di satu function
// tidak pernah bisa di-invalidate dari function lain, jadi query fresh
// tiap kali di sini lebih aman daripada beresiko baca config basi.
// Endpoint ini dipanggil jarang (setup + tiap ada order auto-restock,
// bukan tiap page-load pengunjung), jadi ongkos query tambahan murah.
// ══════════════════════════════════════════════════════════════════

export type PartnerApiConfig = { apiKey: string; resellerId: string };

export async function getPartnerApiConfig(): Promise<PartnerApiConfig> {
  const admin = createAdminSupabase();
  if (!admin) {
    return {
      apiKey: (process.env.PARTNER_API_KEY || "").trim(),
      resellerId: (process.env.PARTNER_API_RESELLER_ID || "").trim(),
    };
  }

  const { data } = await admin.from("app_settings").select("value").eq("key", "partner_api").maybeSingle();
  const stored = (data?.value || {}) as Partial<PartnerApiConfig>;
  return {
    apiKey: (stored.apiKey || process.env.PARTNER_API_KEY || "").trim(),
    resellerId: (stored.resellerId || process.env.PARTNER_API_RESELLER_ID || "").trim(),
  };
}

/**
 * Cocokkan header X-API-Key request dengan key yang tersimpan.
 * Dibungkus timing-safe-ish (panjang sama + compare) supaya tidak
 * kebobolan lewat perbandingan string biasa -- overkill untuk resiko
 * di sini, tapi murah untuk dilakukan.
 */
export function isValidPartnerApiKey(headerValue: string | null, configuredKey: string): boolean {
  if (!headerValue || !configuredKey) return false;
  if (headerValue.length !== configuredKey.length) return false;
  let mismatch = 0;
  for (let i = 0; i < headerValue.length; i++) {
    mismatch |= headerValue.charCodeAt(i) ^ configuredKey.charCodeAt(i);
  }
  return mismatch === 0;
}
