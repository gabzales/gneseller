import "server-only";
import { createHash, createHmac, randomUUID } from "crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";

// ══════════════════════════════════════════════════════════════════
// Integrasi dengan Reseller API vipibmstore.com (v2) -- dipakai untuk
// product_durations dengan stock_mode = 'auto': key digenerate langsung
// dari provider setiap ada order, bukan diambil dari pool manual
// (key_stock). Ini port dari reseller-api.js proyek GHOST NEWERA, jadi
// perilakunya sengaja sama: HMAC-SHA256 signing, cache katalog produk 3
// menit, idempotency key wajib di setiap order.
//
// Kredensial diambil dari (urutan prioritas):
//   1. app_settings row 'reseller_api' -- diisi admin lewat
//      /dashboard/admin/settings (lihat src/app/api/admin/settings/provider).
//   2. Env var RESELLER_API_KEY / RESELLER_API_SECRET / RESELLER_API_BASE_URL.
//
// PENTING: API Key & Secret bisa dipakai motong saldo reseller di sisi
// provider. Jangan pernah commit nilai asli, jangan kirim di chat.
// ══════════════════════════════════════════════════════════════════

const DEFAULT_BASE_URL = "https://vipibmstore.com/api/reseller";
const REQUEST_TIMEOUT_MS = 25000;

type ProviderConfig = { apiKey: string; apiSecret: string; baseUrl: string };

type ProviderResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; code: string; message: string; status?: number };

export type ProviderProduct = {
  id: string;
  product_name: string;
  item_name: string;
  price?: number;
  stock?: number | "unlimited";
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
  const body: Record<string, unknown> = { product_item_id: productItemId, quantity: 1 };
  if (customerReference) body.customer_reference = customerReference.slice(0, 191);
  return doRequest({ method: "POST", relativePath: "/v2/orders", body, idempotencyKey });
}
