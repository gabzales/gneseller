"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export default function NewProductForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal membuat produk.");
      router.push(`/dashboard/admin/products/${data.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl2 bg-primary px-4 py-2.5 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
      >
        <Plus size={15} /> Produk Baru
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-xl2 border border-border bg-surface p-4">
      <p className="text-[13px] font-bold">Produk Baru</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama produk"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Kategori (contoh: Free Fire)"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary"
        />
      </div>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
        >
          {busy ? "Menyimpan..." : "Simpan & Lanjut Edit"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-ink-dim hover:bg-surface-2"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
