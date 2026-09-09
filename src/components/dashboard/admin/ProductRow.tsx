"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Trash2 } from "lucide-react";
import type { AdminProduct } from "@/lib/types";

export default function ProductRow({ product }: { product: AdminProduct }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    await fetch(`/api/admin/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !product.active }),
    });
    router.refresh();
    setBusy(false);
  }

  async function remove() {
    if (!confirm(`Hapus produk "${product.name}"? Semua durasi & stok key ikut terhapus.`)) return;
    setBusy(true);
    await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
    router.refresh();
    setBusy(false);
  }

  const totalStock = product.durations.reduce(
    (sum, d) => sum + (d.stockMode === "manual" ? d.manualStock : 0),
    0
  );
  const hasAuto = product.durations.some((d) => d.stockMode === "auto");

  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <Link href={`/dashboard/admin/products/${product.id}`} className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold">{product.name}</p>
        <p className="truncate text-[11.5px] text-ink-faint">
          {product.category} · {product.durations.length} durasi
          {hasAuto ? " · sebagian Auto (provider)" : ` · stok manual: ${totalStock}`}
        </p>
      </Link>

      <button
        type="button"
        onClick={toggleActive}
        disabled={busy}
        className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
          product.active ? "bg-teal-dim text-teal" : "bg-surface-2 text-ink-faint"
        }`}
      >
        {product.active ? "Aktif" : "Nonaktif"}
      </button>

      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-danger-dim hover:text-danger"
        aria-label="Hapus produk"
      >
        <Trash2 size={15} />
      </button>

      <Link
        href={`/dashboard/admin/products/${product.id}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:text-ink"
      >
        <ChevronRight size={16} />
      </Link>
    </div>
  );
}
