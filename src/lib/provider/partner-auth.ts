import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";

// ══════════════════════════════════════════════════════════════════
// Partner API (server-to-server) config -- dipakai oleh
// /api/v1/partner/** supaya toko client lain (misal RYAN NEW ERA)
// bisa auto-restock key dari GhostSeller TANPA login/cookie session
// (beda dari /api/generate-key yang pakai session Supabase Auth).
//
// MULTI-KEY (Sep 2026): satu toko client = satu API key sendiri, masing-
// masing terikat ke akun reseller-nya sendiri (saldo & harga tier
// terpisah), bisa dinonaktifkan/dihapus tanpa ganggu key lain.
//
// Bentuk data di app_settings row 'partner_api':
//   { keys: [{ id, label, apiKey, resellerId, active, createdAt }] }
// Bentuk LAMA ({ apiKey, resellerId }) tetap terbaca otomatis sebagai satu
// key berlabel "Default" -- gak perlu migrasi manual, dan baru berubah
// jadi bentuk baru begitu admin menyimpan sesuatu dari panel.
//
// Fallback terakhir: env var PARTNER_API_KEY / PARTNER_API_RESELLER_ID
// (dipakai kalau tidak ada key tersimpan di database sama sekali).
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

export type PartnerKey = {
  id: string;
  label: string;
  apiKey: string;
  resellerId: string;
  active: boolean;
  createdAt: string | null;
};

type StoredPartnerApi = {
  keys?: Array<Partial<PartnerKey>>;
  // bentuk lama (single key)
  apiKey?: string;
  resellerId?: string;
};

/** Ubah isi app_settings.partner_api (bentuk baru ATAU lama) jadi daftar key seragam. */
export function normalizePartnerKeys(stored: StoredPartnerApi | null | undefined): PartnerKey[] {
  const value = stored || {};
  if (Array.isArray(value.keys)) {
    return value.keys
      .filter((k) => k && k.id && k.apiKey)
      .map((k) => ({
        id: String(k.id),
        label: String(k.label || "Tanpa nama"),
        apiKey: String(k.apiKey),
        resellerId: String(k.resellerId || ""),
        active: k.active !== false,
        createdAt: k.createdAt ?? null,
      }));
  }
  if (value.apiKey) {
    return [
      {
        id: "legacy",
        label: "Default",
        apiKey: String(value.apiKey),
        resellerId: String(value.resellerId || ""),
        active: true,
        createdAt: null,
      },
    ];
  }
  return [];
}

export async function getPartnerKeys(): Promise<PartnerKey[]> {
  const admin = createAdminSupabase();
  let keys: PartnerKey[] = [];
  if (admin) {
    const { data } = await admin.from("app_settings").select("value").eq("key", "partner_api").maybeSingle();
    keys = normalizePartnerKeys(data?.value as StoredPartnerApi | null);
  }
  const envKey = (process.env.PARTNER_API_KEY || "").trim();
  if (keys.length === 0 && envKey) {
    keys = [
      {
        id: "env",
        label: "Environment variable",
        apiKey: envKey,
        resellerId: (process.env.PARTNER_API_RESELLER_ID || "").trim(),
        active: true,
        createdAt: null,
      },
    ];
  }
  return keys;
}

/**
 * Cocokkan header X-API-Key request dengan SEMUA key aktif. Perbandingan
 * timing-safe dan SENGAJA tidak berhenti di key pertama yang cocok --
 * semua key dibandingkan tiap request supaya waktu respons tidak
 * membocorkan "key ke berapa yang hampir benar".
 */
export async function authenticatePartnerRequest(headerValue: string | null): Promise<PartnerKey | null> {
  if (!headerValue) return null;
  const keys = await getPartnerKeys();
  let matched: PartnerKey | null = null;
  for (const k of keys) {
    if (k.active && isValidPartnerApiKey(headerValue, k.apiKey)) matched = k;
  }
  return matched;
}

/** Perbandingan string timing-safe-ish (panjang sama + XOR semua karakter). */
export function isValidPartnerApiKey(headerValue: string | null, configuredKey: string): boolean {
  if (!headerValue || !configuredKey) return false;
  if (headerValue.length !== configuredKey.length) return false;
  let mismatch = 0;
  for (let i = 0; i < headerValue.length; i++) {
    mismatch |= headerValue.charCodeAt(i) ^ configuredKey.charCodeAt(i);
  }
  return mismatch === 0;
}
