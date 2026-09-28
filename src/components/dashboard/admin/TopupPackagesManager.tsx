"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, Check, X, EyeOff, Eye } from "lucide-react";
import { formatIDR } from "@/lib/format";

type TopupPackageRow = {
  id: string;
  nominal: number;
  bonus: number;
  active: boolean;
  sortOrder: number;
};

export default function TopupPackagesManager({ initialPackages }: { initialPackages: TopupPackageRow[] }) {
  const router = useRouter();
  const [packages, setPackages] = useState(initialPackages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newNominal, setNewNominal] = useState("");
  const [newBonus, setNewBonus] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  const [editNominal, setEditNominal] = useState("");
  const [editBonus, setEditBonus] = useState("");

  function refreshFromServer() {
    router.refresh();
  }

  async function addPackage(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/topup-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nominal: Number(newNominal),
          bonus: Number(newBonus) || 0,
          sortOrder: packages.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menambah paket.");
      setPackages((prev) => [...prev, data.package].sort((a, b) => a.sortOrder - b.sortOrder));
      setNewNominal("");
      setNewBonus("");
      setShowNewForm(false);
      refreshFromServer();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: TopupPackageRow) {
    setEditingId(p.id);
    setEditNominal(String(p.nominal));
    setEditBonus(String(p.bonus));
    setError(null);
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/topup-packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nominal: Number(editNominal), bonus: Number(editBonus) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menyimpan perubahan.");
      setPackages((prev) => prev.map((p) => (p.id === id ? data.package : p)));
      setEditingId(null);
      refreshFromServer();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: TopupPackageRow) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/topup-packages/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !p.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal mengubah status.");
      setPackages((prev) => prev.map((row) => (row.id === p.id ? data.package : row)));
      refreshFromServer();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removePackage(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/topup-packages/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Gagal menghapus paket.");
      }
      setPackages((prev) => prev.filter((p) => p.id !== id));
      refreshFromServer();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!showNewForm ? (
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="mb-3 flex items-center gap-1.5 rounded-xl2 bg-primary px-4 py-2.5 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
        >
          <Plus size={15} /> Tambah Paket
        </button>
      ) : (
        <form onSubmit={addPackage} className="mb-4 rounded-xl2 border border-border bg-surface p-4">
          <p className="text-[13px] font-bold">Paket Baru</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              required
              type="number"
              min={1}
              value={newNominal}
              onChange={(e) => setNewNominal(e.target.value)}
              placeholder="Nominal (Rp)"
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary"
            />
            <input
              type="number"
              min={0}
              value={newBonus}
              onChange={(e) => setNewBonus(e.target.value)}
              placeholder="Bonus (Rp, opsional)"
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
            >
              Simpan
            </button>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-ink-dim hover:bg-surface-2"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {error && <p className="mb-3 text-[12px] text-danger">{error}</p>}

      {packages.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-border p-8 text-center text-[13px] text-ink-faint">
          Belum ada paket top up.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl2 border border-border bg-surface">
          {packages.map((p) => (
            <div key={p.id} className="px-5 py-4">
              {editingId === p.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={editNominal}
                    onChange={(e) => setEditNominal(e.target.value)}
                    className="w-32 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-[12.5px] outline-none focus:border-primary"
                  />
                  <input
                    type="number"
                    min={0}
                    value={editBonus}
                    onChange={(e) => setEditBonus(e.target.value)}
                    className="w-32 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-[12.5px] outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(p.id)}
                    disabled={busy}
                    className="flex items-center gap-1 rounded-lg bg-teal px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
                  >
                    <Check size={13} /> Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-ink-dim hover:bg-surface-2"
                  >
                    <X size={13} /> Batal
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13.5px] font-bold ${!p.active ? "text-ink-faint line-through" : ""}`}>
                      {formatIDR(p.nominal)}
                    </p>
                    <p className="text-[11.5px] text-ink-faint">
                      {p.bonus > 0
                        ? `+ Bonus ${formatIDR(p.bonus)} · Dapat ${formatIDR(p.nominal + p.bonus)}`
                        : "Tanpa bonus"}
                      {!p.active && " · Nonaktif"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleActive(p)}
                    disabled={busy}
                    className="shrink-0 rounded-lg p-2 text-ink-faint hover:bg-surface-2 hover:text-ink disabled:opacity-60"
                    aria-label={p.active ? "Nonaktifkan" : "Aktifkan"}
                    title={p.active ? "Nonaktifkan" : "Aktifkan"}
                  >
                    {p.active ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="shrink-0 rounded-lg p-2 text-ink-faint hover:bg-surface-2 hover:text-ink"
                    aria-label="Edit"
                    title="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePackage(p.id)}
                    disabled={busy}
                    className="shrink-0 rounded-lg p-2 text-ink-faint hover:bg-surface-2 hover:text-danger disabled:opacity-60"
                    aria-label="Hapus"
                    title="Hapus"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
