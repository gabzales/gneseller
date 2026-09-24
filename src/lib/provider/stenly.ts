import "server-only";
import crypto from "crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";

// ══════════════════════════════════════════════════════════════════
// stenly.id QRIS gateway -- kredensial pakai pola yang SAMA PERSIS
// dengan genspay.ts (DB-first via app_settings, env var fallback, cache
// 30 detik per-instance) supaya perilakunya konsisten dan gampang
// dipelihara bareng. Baca dokumentasi resmi (stenly.id/docs) sebelum
// ubah apapun di sini -- terutama header signature webhook
// (X-Stenly-Signature, HMAC-SHA256 dari RAW body pakai Webhook Secret,
// BUKAN Secret Key API) dan bentuk response create-charge/cancel.
// ══════════════════════════════════════════════════════════════════

const DEFAULT_BASE_URL = "https://stenly.id/api/v1";

export type StenlyConfig = { apiKey: string; webhookSecret: string; baseUrl: string };

const CONFIG_CACHE_TTL_MS = 30_000;
let cachedConfig: StenlyConfig | null = null;
let cachedAt = 0;

export async function getStenlyConfig(): Promise<StenlyConfig> {
  if (cachedConfig && Date.now() - cachedAt < CONFIG_CACHE_TTL_MS) {
    return cachedConfig;
  }
  let stored: Partial<StenlyConfig> = {};
  const admin = createAdminSupabase();
  if (admin) {
    const { data } = await admin.from("app_settings").select("value").eq("key", "stenly").maybeSingle();
    if (data?.value) stored = data.value as Partial<StenlyConfig>;
  }
  const config: StenlyConfig = {
    apiKey: (stored.apiKey || process.env.STENLY_API_KEY || "").trim(),
    webhookSecret: (stored.webhookSecret || process.env.STENLY_WEBHOOK_SECRET || "").trim(),
    baseUrl: (stored.baseUrl || process.env.STENLY_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, ""),
  };
  cachedConfig = config;
  cachedAt = Date.now();
  return config;
}

export function invalidateStenlyConfigCache() {
  cachedConfig = null;
  cachedAt = 0;
}

export async function isStenlyConfigured(): Promise<boolean> {
  const { apiKey, webhookSecret, baseUrl } = await getStenlyConfig();
  return Boolean(apiKey && webhookSecret && baseUrl);
}

// ── Gateway aktif: satu saklar global dipakai bareng oleh topup & webhook,
// disimpan di app_settings key 'payment_gateway' ({ active: 'genspay' |
// 'stenly' }). Default 'genspay' kalau belum pernah diisi sama sekali,
// supaya toko yang sudah jalan tidak tiba-tiba pindah gateway diam-diam
// begitu kode ini di-deploy. ──
export type ActivePaymentGateway = "genspay" | "stenly";

export async function getActivePaymentGateway(): Promise<ActivePaymentGateway> {
  const admin = createAdminSupabase();
  if (!admin) return "genspay";
  const { data } = await admin.from("app_settings").select("value").eq("key", "payment_gateway").maybeSingle();
  const active = (data?.value as { active?: string } | null)?.active;
  return active === "stenly" ? "stenly" : "genspay";
}

// ── Create Charge (POST /charge) ──
export type StenlyChargeResult =
  | { success: true; qrString: string; qrImageUrl: string; paymentUrl: string; expiresAt: string | null }
  | { success: false; message: string };

export async function createStenlyCharge(params: {
  orderId: string;
  grossAmount: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  expiryMinutes?: number;
}): Promise<StenlyChargeResult> {
  const { apiKey, baseUrl } = await getStenlyConfig();
  if (!apiKey || !baseUrl) {
    return { success: false, message: "stenly.id belum dikonfigurasi (API Key/Base URL kosong)." };
  }
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/charge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        order_id: params.orderId,
        gross_amount: params.grossAmount,
        customer_name: params.customerName,
        customer_email: params.customerEmail,
        customer_phone: params.customerPhone,
        expiry_minutes: params.expiryMinutes,
      }),
    });
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "stenly.id tidak terjangkau." };
  }
  const json = (await res.json().catch(() => null)) as {
    status?: string;
    message?: string;
    data?: { qr_string: string; qr_image_url: string; payment_url: string; expires_at?: string };
  } | null;
  if (!res.ok || json?.status !== "success" || !json.data?.qr_string) {
    return { success: false, message: json?.message || `stenly.id menolak request (HTTP ${res.status}).` };
  }
  return {
    success: true,
    qrString: json.data.qr_string,
    qrImageUrl: json.data.qr_image_url,
    paymentUrl: json.data.payment_url,
    expiresAt: json.data.expires_at || null,
  };
}

// ── Cek status (dipakai debug/manual re-check, BUKAN sumber kebenaran
// utama -- webhook tetap yang men-settle -- sama seperti pola GensPay) ──
export async function checkStenlyStatus(orderId: string): Promise<
  { success: true; status: string } | { success: false; message: string }
> {
  const { apiKey, baseUrl } = await getStenlyConfig();
  if (!apiKey || !baseUrl) return { success: false, message: "stenly.id belum dikonfigurasi." };
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/status/${encodeURIComponent(orderId)}`, {
      headers: { "x-api-key": apiKey },
    });
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "stenly.id tidak terjangkau." };
  }
  const json = (await res.json().catch(() => null)) as { status?: string; data?: { status?: string } } | null;
  if (!res.ok || json?.status !== "success" || !json.data?.status) {
    return { success: false, message: `Gagal cek status (HTTP ${res.status}).` };
  }
  return { success: true, status: json.data.status };
}

/**
 * Verifikasi HMAC-SHA256 signature dari header X-Stenly-Signature, dihitung
 * dari RAW body pakai Webhook Secret (whsec_..., BUKAN Secret Key sk_...
 * yang dipakai buat auth API call biasa -- dua kredensial ini SENGAJA
 * dipisah oleh stenly.id, lihat tabel "Autentikasi & Format Keys" di
 * dokumentasi mereka). Tahan timing-attack (crypto.timingSafeEqual),
 * pola sama dengan verifikasi signature GensPay di webhooks/topup/route.ts.
 */
export function verifyStenlySignature(rawBody: string, signatureHeader: string | null, webhookSecret: string): boolean {
  if (!signatureHeader || !webhookSecret) return false;
  const computed = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(computed);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
