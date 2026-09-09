"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { AdminProduct } from "@/lib/types";
import DurationRow from "@/components/dashboard/admin/DurationRow";

export default function ProductEditor({ product }: { product: AdminProduct }) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDays, setNewDays] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function saveProductFields() {
    setBusy(true);
    await fetch(`/api/admin/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category }),
    });
    setBusy(false);
    setSavedAt(Date.now());
    router.refresh();
  }

  async function addDuration(e: React.FormEvent) {
    e.preventDefault();
    setAddBusy(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/durations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel, days: Number(newDays), price: Number(newPrice) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menambah durasi.");
      setNewLabel("");
      setNewDays("");
      setNewPrice("");
      setShowAdd(false);
      router.refresh();
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAddBusy(false);
    }
  }

  return (
    <div>
      <div className="rounded-xl2 border border-border bg-surface p-5">
        <p className="text-[13px] font-bold">Info Produk</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] font-semibold text-ink-faint">
            Nama
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
            />
          </label>
          <label className="text-[11px] font-semibold text-ink-faint">
            Kategori
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={saveProductFields}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
          >
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
          {savedAt && <span className="text-[11.5px] text-teal">Tersimpan.</span>}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[13px] font-bold">Durasi & Harga</p>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-primary-dim px-3 py-1.5 text-[12px] font-bold text-primary"
        >
          <Plus size={13} /> Tambah Durasi
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addDuration} className="mt-2 rounded-xl2 border border-border bg-surface p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              required
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (contoh: 7 Days)"
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary"
            />
            <input
              required
              type="number"
              min={1}
              value={newDays}
              onChange={(e) => setNewDays(e.target.value)}
              placeholder="Jumlah hari"
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary"
            />
            <input
              required
              type="number"
              min={0}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="Harga (Rp)"
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary"
            />
          </div>
          {addError && <p className="mt-2 text-[12px] text-danger">{addError}</p>}
          <button
            type="submit"
            disabled={addBusy}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
          >
            {addBusy ? "Menambah..." : "Tambah"}
          </button>
        </form>
      )}

      <div className="mt-3 space-y-3">
        {product.durations.length === 0 ? (
          <div className="rounded-xl2 border border-dashed border-border p-6 text-center text-[12.5px] text-ink-faint">
            Belum ada durasi. Reseller tidak akan bisa beli produk ini sampai ada minimal 1 durasi.
          </div>
        ) : (
          product.durations.map((d) => (
            <DurationRow key={d.id} productId={product.id} duration={d} />
          ))
        )}
      </div>
    </div>
  );
}
