import "server-only";
import { createHash, createHmac, randomUUID } from "crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";

// ══════════════════════════════════════════════════════════════════
// Integrasi dengan Reseller API V2 VIP Best Mods (vipbestmods.com --
// sebelumnya dikenal sebagai vipibmstore.com, domain lama tetap didukung
// lewat override baseUrl kalau kredensial lama belum dipindah) -- dipakai
// untuk product_durations dengan stock_mode = 'auto': key digenerate
// langsung dari provider setiap ada order, bukan diambil dari pool manual
// (key_stock). HMAC-SHA256 signing, cache katalog produk 3 menit,
// idempotency key wajib di setiap order.
//
// PENTING -- dua istilah "stock_mode" yang BEDA KONTEKS, jangan tertukar:
//   - product_durations.stock_mode (kolom kita sendiri): 'manual' | 'auto'
//     -- nentuin apakah key diambil dari key_stock pool kita, atau dari
//     provider ini.
//   - ProviderProduct.stock_mode (field dari VIP Best Mods): 'v2' | 'manual'
//     -- nentuin apakah item itu unlimited di sisi MEREKA, atau harus dicek
//     GET /stock dulu sebelum order (lihat assertProviderItemPurchasable).
//
// Kredensial diambil dari (urutan prioritas):
//   1. app_settings row 'reseller_api' -- diisi admin lewat
//      /dashboard/admin/settings (lihat src/app/api/admin/settings/provider).
//   2. Env var RESELLER_API_KEY / RESELLER_API_SECRET / RESELLER_API_BASE_URL.
//
// PENTING: API Key & Secret bisa dipakai motong saldo reseller di sisi
// provider. Jangan pernah commit nilai asli, jangan kirim di chat.
// ══════════════════════════════════════════════════════════════════

const DEFAULT_BASE_URL = "https://vipbestmods.com/api/reseller";
const REQUEST_TIMEOUT_MS = 25000;

type ProviderConfig = { apiKey: string; apiSecret: string; baseUrl: string };

type ProviderResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; code: string; message: string; status?: number };

export type ProviderProduct = {
  id: string;
  product_id?: string;
  product_slug?: string;
  product_name: string;
  product_image?: string;
  item_name: string;
  category?: string;
  price?: number;
  stock?: number | "unlimited";
  stock_mode?: "v2" | "manual";
  status?: "active" | "out-of-stock";
};

export type ProviderStockRow = {
  item_id: string;
  product_id?: string;
  product_name?: string;
  item_name?: string;
  category?: string;
  price?: number;
  stock?: number | "unlimited";
  stock_mode?: "v2" | "manual";
  status?: "active" | "out-of-stock";
  is_active?: boolean;
  message?: string;
};

let cachedConfig: ProviderConfig | null = null;

async function getConfig(): Promise<ProviderConfig> {
  if (cachedConfig) return cachedConfig;

  let stored: Partial<ProviderConfig> = {};
  const admin = createAdminSupabase();
  if (admin) {
    const { data } = await admin.from("app_settings").select("value").eq("key", "reseller_api").single();
    if (data?.value) stored = data.value as Partial<ProviderConfig>;
  }

  const config: ProviderConfig = {
    apiKey: (stored.apiKey || process.env.RESELLER_API_KEY || "").trim(),
    apiSecret: (stored.apiSecret || process.env.RESELLER_API_SECRET || "").trim(),
    baseUrl: (stored.baseUrl || process.env.RESELLER_API_BASE_URL || DEFAULT_BASE_URL)
      .trim()
      .replace(/\/+$/, ""),
  };
  cachedConfig = config;
  return config;
}

/** Call after saving new credentials so the next request re-reads them. */
export function invalidateProviderConfigCache() {
  cachedConfig = null;
}

export async function isProviderConfigured(): Promise<boolean> {
  const { apiKey, apiSecret } = await getConfig();
  return Boolean(apiKey && apiSecret);
}

function sign({
  method,
  path,
  timestamp,
  nonce,
  rawBody,
  apiSecret,
}: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  rawBody: string;
  apiSecret: string;
}) {
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const canonical = [method, path, timestamp, nonce, bodyHash].join("\n");
  const secretHash = createHash("sha256").update(apiSecret).digest("hex");
  return createHmac("sha256", secretHash).update(canonical).digest("hex");
}

async function doRequest<T = unknown>({
  method,
  relativePath,
  body,
  idempotencyKey,
}: {
  method: "GET" | "POST";
  relativePath: string;
  body?: unknown;
  idempotencyKey?: string;
}): Promise<ProviderResult<T>> {
  const { apiKey, apiSecret, baseUrl } = await getConfig();
  if (!apiKey || !apiSecret) {
    return {
      success: false,
      code: "NOT_CONFIGURED",
      message: "Reseller API Key/Secret belum diatur di panel admin.",
    };
  }

  let url: URL;
  try {
    url = new URL(baseUrl.replace(/\/+$/, "") + "/" + relativePath.replace(/^\/+/, ""));
  } catch {
    return { success: false, code: "INVALID_BASE_URL", message: "Base URL Reseller API tidak valid." };
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const rawBody = method === "GET" ? "" : JSON.stringify(body || {});
  const signature = sign({ method, path: url.pathname, timestamp, nonce, rawBody, apiSecret });

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "x-timestamp": timestamp,
    "x-nonce": nonce,
    "x-signature": signature,
  };
  if (method !== "GET") headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey.slice(0, 191);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: method === "GET" ? undefined : rawBody,
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: { success?: boolean; code?: string; message?: string; data?: T } = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      // respon kosong / bukan JSON -- ditangani di bawah lewat status code
    }

    if (!res.ok || parsed.success === false) {
      return {
        success: false,
        code: parsed.code || `HTTP_${res.status}`,
        message: parsed.message || `Reseller API mengembalikan status ${res.status}`,
        status: res.status,
      };
    }

    return { success: true, data: parsed.data as T };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      success: false,
      code: aborted ? "TIMEOUT" : "NETWORK_ERROR",
      message: aborted ? "Timeout menghubungi Reseller API" : (e as Error).message || "Gagal menghubungi Reseller API",
    };
  } finally {
    clearTimeout(timer);
  }
}

let productsCache: { data: ProviderProduct[] | null; fetchedAt: number } = { data: null, fetchedAt: 0 };
const PRODUCTS_CACHE_TTL_MS = 3 * 60 * 1000;

/** Katalog produk provider, dipakai admin buat mapping provider_item_id. */
export async function getProviderProducts(opts?: { fresh?: boolean }): Promise<ProviderResult<ProviderProduct[]>> {
  const now = Date.now();
  if (!opts?.fresh && productsCache.data && now - productsCache.fetchedAt < PRODUCTS_CACHE_TTL_MS) {
    return { success: true, data: productsCache.data };
  }
  const result = await doRequest<ProviderProduct[]>({ method: "GET", relativePath: "/v2/products" });
  if (result.success && Array.isArray(result.data)) {
    productsCache = { data: result.data, fetchedAt: now };
  }
  return result;
}

export async function getProviderBalance(): Promise<ProviderResult<{ balance: number }>> {
  return doRequest({ method: "GET", relativePath: "/v2/balance" });
}

/** GET /v2/stock?item_ids=1,2,3 -- maks 100 id per panggilan. */
export async function getProviderStock(itemIds: string[]): Promise<ProviderResult<ProviderStockRow[]>> {
  const ids = itemIds.map(String).filter(Boolean);
  if (ids.length === 0) {
    return { success: false, code: "INVALID_ARGUMENT", message: "itemIds tidak boleh kosong." };
  }
  if (ids.length > 100) {
    return { success: false, code: "INVALID_ARGUMENT", message: "Maksimal 100 item_ids per panggilan GET /stock." };
  }
  return doRequest<ProviderStockRow[]>({ method: "GET", relativePath: `/v2/stock?item_ids=${encodeURIComponent(ids.join(","))}` });
}

/**
 * Aturan stock provider (WAJIB dipatuhi sebelum orderProviderKey()):
 *   - stock_mode 'v2'     -> UNLIMITED di sisi provider, tidak perlu dicek.
 *   - stock_mode 'manual' -> WAJIB GET /stock dulu; hanya boleh order kalau
 *     status === 'active' DAN is_active === true.
 * Dipanggil dengan productStockMode dari katalog (getProviderProducts(),
 * biasanya sudah di-cache admin saat mapping) supaya tidak perlu narik
 * katalog penuh cuma buat tahu 1 field ini.
 */
export async function assertProviderItemPurchasable(
  providerItemId: string,
  productStockMode: "v2" | "manual" | undefined
): Promise<{ purchasable: true } | { purchasable: false; reason: string }> {
  if (productStockMode !== "manual") {
    // Default aman: kalau stock_mode gak diketahui (belum di-cache), anggap
    // 'v2' (unlimited) -- SAMA seperti behavior lama sebelum endpoint /stock
    // ada, supaya tidak tiba-tiba nge-block order yang sebelumnya jalan
    // normal cuma karena field ini kosong.
    return { purchasable: true };
  }
  const stockResult = await getProviderStock([providerItemId]);
  if (!stockResult.success) {
    return { purchasable: false, reason: stockResult.message };
  }
  const row = stockResult.data.find((r) => String(r.item_id) === String(providerItemId));
  if (!row) return { purchasable: false, reason: "Item tidak ditemukan di GET /stock." };
  if (row.status !== "active" || row.is_active !== true) {
    return { purchasable: false, reason: row.message || "Stok manual tidak tersedia saat ini." };
  }
  return { purchasable: true };
}

/**
 * Order 1 key langsung dari provider. idempotencyKey WAJIB stabil untuk
 * order yang sama (dipanggil dengan reseller_keys id yang akan dipakai
 * kalau order ini sukses) supaya retry tidak dobel memotong saldo
 * provider / generate 2 key untuk 1 pembelian.
 */
export async function orderProviderKey({
  productItemId,
  idempotencyKey,
  customerReference,
}: {
  productItemId: string;
  idempotencyKey: string;
  customerReference?: string;
}): Promise<ProviderResult<{ codes: string[] }>> {
  if (!productItemId) {
    return { success: false, code: "MISSING_ITEM_ID", message: "product_item_id belum di-mapping untuk produk ini." };
  }
  // FIX (Sep 2026): "Invalid request" gagal terus-terusan di semua produk
  // stock_mode=auto (PATO BLUE dkk) -- root cause: kolom provider_item_id
  // kita itu text ("5"), dan dikirim apa adanya ke vipibmstore.com. Tapi
  // katalog mereka sendiri (GET /v2/products) balikin id sebagai JSON
  // NUMBER (5), dan API mereka validasi tipe secara strict -- product_item_id
  // string ditolak sebagai "Invalid request" walau nilainya "sama" secara
  // visual. Dikonfirmasi lewat /api/debug/provider-mapping (rawCatalogIdSample
  // idType: "number"). Kalau provider_item_id kita ternyata bukan angka murni
  // (harusnya gak terjadi kalau mapping-nya benar), Number() bakal balikin
  // NaN -- di-guard di bawah biar gagal jelas ("Mapping ID bukan angka")
  // daripada diam-diam kekirim NaN ke provider.
  const numericItemId = Number(productItemId);
  if (!Number.isFinite(numericItemId)) {
    return {
      success: false,
      code: "INVALID_ITEM_ID_FORMAT",
      message: `product_item_id "${productItemId}" bukan angka valid -- cek ulang mapping produk ini.`,
    };
  }
  const body: Record<string, unknown> = { product_item_id: numericItemId, quantity: 1 };
  if (customerReference) body.customer_reference = customerReference.slice(0, 191);
  return doRequest({ method: "POST", relativePath: "/v2/orders", body, idempotencyKey });
}

/**
 * Tabel aksi error -> pesan customer, sesuai spesifikasi resmi VIP Best
 * Mods. PENTING: INVALID_SIGNATURE / INVALID_TIMESTAMP / REPLAY_DETECTED
 * SENGAJA tidak ada di tabel ini -- itu bug di sisi kita (canonical string,
 * jam server, atau nonce kepakai ulang), BUKAN kesalahan customer. Kode
 * tersebut selalu di-log dan dibalas pesan generik, tidak pernah pesan
 * teknis mentah dari provider.
 */
const SENSITIVE_PROVIDER_CODES = new Set(["INVALID_SIGNATURE", "INVALID_TIMESTAMP", "REPLAY_DETECTED"]);

export function providerErrorToCustomerMessage(code: string, rawMessage: string): { message: string; chargeCustomer: boolean } {
  if (SENSITIVE_PROVIDER_CODES.has(code)) {
    console.error(`[vipbestmods] ${code}: ${rawMessage} -- bug sisi kita (signing/jam/nonce), cek kode signing, JANGAN ditampilkan ke customer.`);
    return { message: "Terjadi gangguan sistem, tim kami sudah diberi tahu.", chargeCustomer: false };
  }
  switch (code) {
    case "OUT_OF_STOCK":
      if (/stok v2 habis dan stok manual tidak mencukupi/i.test(rawMessage || "")) {
        return { message: "Stok habis dari provider, harap kontak pemilik API.", chargeCustomer: false };
      }
      return { message: "Stok habis.", chargeCustomer: false };
    case "INSUFFICIENT_BALANCE":
      return { message: "Saldo reseller tidak cukup, silakan topup di dashboard.", chargeCustomer: false };
    case "PRODUCT_INACTIVE":
      return { message: "Varian nonaktif, hubungi pemilik API.", chargeCustomer: false };
    case "SUPPLIER_UNAVAILABLE":
      return { message: "Gangguan supplier, coba lagi.", chargeCustomer: false };
    case "RATE_LIMITED":
      return { message: "Sistem sedang sibuk, coba lagi sebentar lagi.", chargeCustomer: false };
    case "DUPLICATE_REQUEST":
      return { message: "Permintaan duplikat terdeteksi.", chargeCustomer: false };
    case "REQUEST_IN_PROGRESS":
      return { message: "Pesanan sebelumnya masih diproses, mohon tunggu.", chargeCustomer: false };
    default:
      console.error(`[vipbestmods] Kode error tidak dikenal: ${code}: ${rawMessage}`);
      return { message: "Gagal generate key dari provider.", chargeCustomer: false };
  }
}
