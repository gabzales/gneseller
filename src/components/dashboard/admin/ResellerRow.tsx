"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, Tag, Ban, ShieldCheck } from "lucide-react";
import type { AdminResellerRow } from "@/lib/data/admin-resellers";

type CatalogDuration = { id: string; label: string; price: number };
type CatalogProduct = { id: string; name: string; durations: CatalogDuration[] };
type CustomPrice = {
  productId: string;
  durationId: string;
  price: number;
  productName: string;
  durationLabel: string;
  defaultPrice: number | null;
};

export default function ResellerRow({ reseller }: { reseller: AdminResellerRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [banBusy, setBanBusy] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function toggleBan() {
    setBanBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/resellers/${reseller.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banned: !reseller.banned }),
    });
    const data = await res.json();
    setBanBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      setMessage(data.message || "Gagal mengubah status ban.");
    }
  }

  async function confirmDelete() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    setDeleteBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/resellers/${reseller.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.message || "Gagal menghapus reseller.");
      setDeleteBusy(false);
      setDeleteArmed(false);
    }
  }

  async function submit(sign: 1 | -1) {
    const value = Math.trunc(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      setMessage("Isi nominal yang valid dulu.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/resellers/${reseller.id}/adjust-balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: value * sign, note: note || null }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMessage(`Saldo baru: Rp ${data.balance.toLocaleString("id-ID")}`);
      setAmount("");
      setNote("");
      router.refresh();
    } else {
      setMessage(data.message || "Gagal menyesuaikan saldo.");
    }
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[13.5px] font-bold">
            {reseller.name}
            {reseller.banned && (
              <span className="shrink-0 rounded-full bg-danger-dim px-2 py-0.5 text-[10px] font-bold text-danger">
                BANNED
              </span>
            )}
          </p>
          <p className="truncate text-[11.5px] text-ink-faint">{reseller.email}</p>
        </div>
        <p className="whitespace-nowrap font-display text-[14px] font-bold">
          Rp {reseller.balance.toLocaleString("id-ID")}
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-lg bg-primary-dim px-3 py-1.5 text-[11.5px] font-bold text-primary"
        >
          {open ? "Tutup" : "Sesuaikan"}
        </button>
      </div>

      {open && (
        <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
          <p className="mb-2 text-[11.5px] text-ink-faint">
            Total top up: Rp {reseller.totalTopup.toLocaleString("id-ID")} (dipakai buat tier harga otomatis)
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Nominal (Rp)"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan (opsional, contoh: transfer manual)"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => submit(1)}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg bg-teal px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
            >
              <Plus size={13} /> Tambah
            </button>
            <button
              type="button"
              onClick={() => submit(-1)}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg bg-danger px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
            >
              <Minus size={13} /> Kurangi
            </button>
            {message && <span className="text-[11.5px] text-ink-faint">{message}</span>}
          </div>

          <CustomPriceManager userId={reseller.id} />

          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={toggleBan}
              disabled={banBusy}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-bold disabled:opacity-60 ${
                reseller.banned ? "bg-teal text-white" : "bg-amber text-white"
              }`}
            >
              {reseller.banned ? <ShieldCheck size={13} /> : <Ban size={13} />}
              {reseller.banned ? "Unban" : "Ban"}
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteBusy}
              className="flex items-center gap-1 rounded-lg bg-danger px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
            >
              <Trash2 size={13} />
              {deleteArmed ? "Yakin? Klik lagi" : "Hapus Reseller"}
            </button>
            {deleteArmed && !deleteBusy && (
              <button
                type="button"
                onClick={() => setDeleteArmed(false)}
                className="text-[11.5px] font-semibold text-ink-faint"
              >
                Batal
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">
            Ban memblokir login/transaksi tapi bisa dibalikin. Hapus permanen — semua riwayat key & top up
            reseller ini ikut terhapus.
          </p>
        </div>
      )}
    </div>
  );
}

function CustomPriceManager({ userId }: { userId: string }) {
  const [catalog, setCatalog] = useState<CatalogProduct[] | null>(null);
  const [prices, setPrices] = useState<CustomPrice[] | null>(null);
  const [productId, setProductId] = useState("");
  const [durationId, setDurationId] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  async function load() {
    const [catalogRes, pricesRes] = await Promise.all([
      catalog ? Promise.resolve(null) : fetch("/api/admin/products").then((r) => r.json()),
      fetch(`/api/admin/resellers/${userId}/custom-prices`).then((r) => r.json()),
    ]);
    if (catalogRes) setCatalog(catalogRes.products ?? []);
    setPrices(pricesRes.prices ?? []);
  }

  useEffect(() => {
    if (shown) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const selectedProduct = catalog?.find((p) => p.id === productId);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !durationId) {
      setError("Pilih produk & durasi dulu.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/resellers/${userId}/custom-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, durationId, price: Number(price) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menyimpan harga khusus.");
      setPrice("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: CustomPrice) {
    await fetch(`/api/admin/resellers/${userId}/custom-prices`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: p.productId, durationId: p.durationId }),
    });
    load();
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-faint">
          <Tag size={12} /> Harga khusus untuk reseller ini
        </p>
        {!shown && (
          <button type="button" onClick={() => setShown(true)} className="text-[11.5px] font-semibold text-primary">
            Kelola
          </button>
        )}
      </div>

      {shown && (
        <>
          {!prices ? (
            <p className="mt-2 text-[12px] text-ink-faint">Memuat...</p>
          ) : prices.length === 0 ? (
            <p className="mt-2 text-[12px] text-ink-faint">Belum ada harga khusus untuk reseller ini.</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {prices.map((p) => (
                <div
                  key={`${p.productId}:${p.durationId}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-1.5"
                >
                  <span className="text-[12px]">
                    {p.productName} · {p.durationLabel}: Rp {p.price.toLocaleString("id-ID")}
                    {p.defaultPrice !== null && (
                      <span className="text-ink-faint"> (default Rp {p.defaultPrice.toLocaleString("id-ID")})</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    className="text-ink-faint hover:text-danger"
                    aria-label="Hapus harga khusus"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={add} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setDurationId("");
              }}
              className="rounded-lg border border-border bg-surface px-2 py-2 text-[12px] outline-none focus:border-primary"
            >
              <option value="">Produk...</option>
              {(catalog ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={durationId}
              onChange={(e) => setDurationId(e.target.value)}
              disabled={!selectedProduct}
              className="rounded-lg border border-border bg-surface px-2 py-2 text-[12px] outline-none focus:border-primary disabled:opacity-60"
            >
              <option value="">Durasi...</option>
              {(selectedProduct?.durations ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Harga (Rp)"
              className="rounded-lg border border-border bg-surface px-2 py-2 text-[12px] outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary px-3 py-2 text-[12px] font-bold text-white disabled:opacity-60"
            >
              Simpan
            </button>
          </form>
          {error && <p className="mt-1.5 text-[11.5px] text-danger">{error}</p>}
        </>
      )}
    </div>
  );
}
