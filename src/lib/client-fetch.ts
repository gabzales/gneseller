"use client";

/**
 * Wrapper aman buat fetch() + parse JSON di client component, dipakai
 * pengganti pola manual `const data = await res.json()` yang tersebar di
 * banyak form admin (DurationRow, TopupForm, ProductEditor, dst — lihat
 * hasil audit Sep 2026: 14 file, 20+ titik pakai pola yang sama).
 *
 * Masalah pola lama: kalau server balikin body kosong (koneksi kepotong,
 * function timeout tanpa sempat nulis respons, dll), `res.json()` throw
 * SyntaxError "Unexpected end of JSON input" -- pesan mentah ini sering
 * gak ketangkep try/catch di pemanggilnya, atau ketangkep tapi pesan
 * teknisnya tetap ditampilkan apa adanya ke user (bikin panik, gak jelas
 * harus ngapain, padahal action-nya BISA JADI udah sukses di server dan
 * cuma respons-nya yang gagal sampai).
 *
 * safeFetchJson() SELALU resolve (gak pernah throw) ke bentuk
 * `{ ok, status, data, networkError }` yang gampang dicek pemanggil.
 */
export type SafeFetchResult<T = Record<string, unknown>> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; data: T | null; networkError: boolean; message: string };

export async function safeFetchJson<T = Record<string, unknown>>(
  input: string,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      networkError: true,
      message: err instanceof Error ? `Gagal menghubungi server: ${err.message}` : "Gagal menghubungi server.",
    };
  }

  let parsed: T | null = null;
  try {
    parsed = (await res.json()) as T;
  } catch {
    return {
      ok: false,
      status: res.status,
      data: null,
      networkError: false,
      message:
        "Koneksi terputus saat menunggu respons server. JANGAN langsung ulangi kalau ini action yang " +
        "mengubah data (simpan, generate, top up, dll) -- cek dulu apa perubahannya sudah kejadian, " +
        "baru coba lagi kalau memang belum.",
    };
  }

  if (!res.ok) {
    const msg =
      parsed && typeof parsed === "object" && "message" in parsed && typeof (parsed as { message?: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : `Server merespons status ${res.status}.`;
    return { ok: false, status: res.status, data: parsed, networkError: false, message: msg };
  }

  return { ok: true, status: res.status, data: parsed as T };
}
