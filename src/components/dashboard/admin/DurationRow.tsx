"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { AdminDuration } from "@/lib/types";

type ProviderProduct = { id: string; product_name: string; item_name: string };

export default function DurationRow({ productId, duration }: { productId: string; duration: AdminDuration }) {
  const router = useRouter();
  const [label, setLabel] = useState(duration.label);
  const [days, setDays] = useState(String(duration.days));
  const [price, setPrice] = useState(String(duration.price));
  const [stockMode, setStockMode] = useState(duration.stockMode);
  const [providerItemId, setProviderItemId] = useState(duration.providerItemId ?? "");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function save() {
    setBusy(true);
    await fetch(`/api/admin/products/${productId}/durations/${duration.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        days: Number(days),
        price: Number(price),
        stockMode,
        providerItemId: stockMode === "auto" ? providerItemId || null : null,
      }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Hapus durasi "${duration.label}"? Stok manual yang belum terjual ikut terhapus.`)) return;
    setBusy(true);
    await fetch(`/api/admin/products/${productId}/durations/${duration.id}`, { method: "DELETE" });
    router.refresh();
  }

  const [tierExpanded, setTierExpanded] = useState(false);

  return (
    <div className="rounded-xl2 border border-border bg-surface p-4">
      {/* Input row — stacks vertically on mobile, grid on sm+ */}
      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1.2fr_0.8fr_1fr_auto_auto]">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label durasi"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12.5px] outline-none focus:border-primary"
        />
        <input
          type="number"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="Hari"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12.5px] outline-none focus:border-primary"
        />
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Harga (Rp)"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12.5px] outline-none focus:border-primary"
        />
        <div className="flex gap-2 sm:contents">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-[12px] font-bold text-white disabled:opacity-60 sm:flex-none"
          >
            Simpan
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="flex items-center justify-center rounded-lg px-3 py-2 text-ink-faint transition-colors hover:bg-danger-dim hover:text-danger"
            aria-label="Hapus durasi"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Stock mode + action buttons */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setStockMode("manual")}
            className={`rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
              stockMode === "manual" ? "bg-primary text-white" : "text-ink-dim"
            }`}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => setStockMode("auto")}
            className={`rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
              stockMode === "auto" ? "bg-primary text-white" : "text-ink-dim"
            }`}
          >
            Auto (Provider)
          </button>
        </div>

        {stockMode === "manual" ? (
          <span className={`text-[11.5px] font-semibold ${duration.manualStock > 0 ? "text-teal" : "text-danger"}`}>
            Stok: {duration.manualStock}
          </span>
        ) : (
          <span className="truncate text-[11.5px] text-ink-faint">
            {providerItemId ? `Mapped: ${providerItemId}` : "Belum di-mapping"}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Kelola Tier — tombol terpisah, selalu visible */}
          <button
            type="button"
            onClick={() => setTierExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-dim hover:border-primary hover:text-primary"
          >
            Kelola Tier
            {tierExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* Kelola Stok / Mapping Provider */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11.5px] font-semibold text-primary"
          >
            {stockMode === "manual" ? "Kelola Stok" : "Mapping Provider"}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && stockMode === "manual" && (
        <ManualStockManager productId={productId} durationId={duration.id} onChanged={() => router.refresh()} />
      )}
      {expanded && stockMode === "auto" && (
        <ProviderMapping
          value={providerItemId}
          onChange={setProviderItemId}
          onSave={save}
          busy={busy}
        />
      )}
      {tierExpanded && <TierManager productId={productId} durationId={duration.id} />}
    </div>
  );
}

function TierManager({ productId, durationId }: { productId: string; durationId: string }) {
  const [tiers, setTiers] = useState<{ id: string; minTotalTopup: number; price: number }[] | null>(null);
  const [minTotalTopup, setMinTotalTopup] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/admin/products/${productId}/durations/${durationId}/tiers`);
    const data = await res.json();
    setTiers(data.tiers ?? []);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/durations/${durationId}/tiers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minTotalTopup: Number(minTotalTopup), price: Number(price) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menyimpan tier.");
      setMinTotalTopup("");
      setPrice("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(tierId: string) {
    await fetch(`/api/admin/products/${productId}/durations/${durationId}/tiers/${tierId}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-ink-faint">
          Harga bertingkat berdasarkan total top up reseller (opsional)
        </p>
        {!tiers && (
          <button type="button" onClick={load} className="text-[11.5px] font-semibold text-primary">
            Muat Tier
          </button>
        )}
      </div>

      {tiers && (
        <>
          {tiers.length === 0 ? (
            <p className="mt-2 text-[12px] text-ink-faint">
              Belum ada tier -- semua reseller pakai harga default di atas.
            </p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {tiers.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-1.5"
                >
                  <span className="text-[12px]">
                    Total top up ≥ Rp {t.minTotalTopup.toLocaleString("id-ID")} → Rp {t.price.toLocaleString("id-ID")}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    className="text-ink-faint hover:text-danger"
                    aria-label="Hapus tier"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={add} className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              required
              type="number"
              min={0}
              value={minTotalTopup}
              onChange={(e) => setMinTotalTopup(e.target.value)}
              placeholder="Min. total top up (Rp)"
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12px] outline-none focus:border-primary"
            />
            <input
              required
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Harga (Rp)"
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12px] outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary px-3 py-2 text-[12px] font-bold text-white disabled:opacity-60"
            >
              Tambah
            </button>
          </form>
          {error && <p className="mt-1.5 text-[11.5px] text-danger">{error}</p>}
        </>
      )}
    </div>
  );
}

function ManualStockManager({
  productId,
  durationId,
  onChanged,
}: {
  productId: string;
  durationId: string;
  onChanged: () => void;
}) {
  const [keysText, setKeysText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [list, setList] = useState<{ id: string; key_string: string }[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  async function loadList() {
    setLoadingList(true);
    const res = await fetch(`/api/admin/products/${productId}/durations/${durationId}/stock`);
    const data = await res.json();
    setList(data.keys ?? []);
    setLoadingList(false);
  }

  async function addKeys() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/products/${productId}/durations/${durationId}/stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keysText }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMessage(`${data.added} key ditambahkan.`);
      setKeysText("");
      onChanged();
      if (list) loadList();
    } else {
      setMessage(data.message || "Gagal menambah key.");
    }
  }

  async function deleteKey(id: string) {
    await fetch(`/api/admin/key-stock/${id}`, { method: "DELETE" });
    onChanged();
    loadList();
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-[11px] font-semibold text-ink-faint">
        Paste key baru, satu per baris (dari stok fisik / hasil generate sendiri)
      </p>
      <textarea
        value={keysText}
        onChange={(e) => setKeysText(e.target.value)}
        rows={4}
        placeholder={"XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY"}
        className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[12px] outline-none focus:border-primary"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={addKeys}
          disabled={busy || !keysText.trim()}
          className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
        >
          {busy ? "Menambah..." : "Tambah ke Stok"}
        </button>
        <button
          type="button"
          onClick={loadList}
          className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-ink-dim hover:bg-surface-2"
        >
          {loadingList ? "Memuat..." : list ? "Muat Ulang" : "Lihat Sisa Stok"}
        </button>
        {message && <span className="text-[11.5px] text-ink-faint">{message}</span>}
      </div>

      {list && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border">
          {list.length === 0 ? (
            <p className="p-3 text-[12px] text-ink-faint">Stok kosong.</p>
          ) : (
            list.map((k) => (
              <div key={k.id} className="flex items-center justify-between border-b border-border px-3 py-1.5 last:border-b-0">
                <span className="truncate font-mono text-[11.5px]">{k.key_string}</span>
                <button
                  type="button"
                  onClick={() => deleteKey(k.id)}
                  className="text-ink-faint hover:text-danger"
                  aria-label="Hapus key"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ProviderMapping({
  value,
  onChange,
  onSave,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const [products, setProducts] = useState<ProviderProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCatalog(fresh = false) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/provider/products${fresh ? "?fresh=1" : ""}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.message || "Gagal memuat katalog provider. Cek pengaturan Reseller API.");
      return;
    }
    setProducts(data.products ?? []);
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-[11px] font-semibold text-ink-faint">
        Pilih item di katalog vipibmstore.com yang jadi sumber key produk ini
      </p>

      {!products ? (
        <button
          type="button"
          onClick={() => loadCatalog()}
          disabled={loading}
          className="mt-2 rounded-lg bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-ink-dim disabled:opacity-60"
        >
          {loading ? "Memuat katalog..." : "Muat Katalog Provider"}
        </button>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12.5px] outline-none focus:border-primary"
          >
            <option value="">— pilih item provider —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.product_name} — {p.item_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadCatalog(true)}
            className="shrink-0 text-[11.5px] font-semibold text-primary"
          >
            Refresh
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}

      <button
        type="button"
        onClick={onSave}
        disabled={busy || !value}
        className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
      >
        Simpan Mapping
      </button>
    </div>
  );
}
