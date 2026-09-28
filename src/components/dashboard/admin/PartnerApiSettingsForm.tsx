"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, CheckCircle2, Copy, Trash2, RefreshCw, BookOpen } from "lucide-react";

type KeyRow = {
  id: string;
  label: string;
  apiKeyMasked: string;
  resellerEmail: string;
  resellerLinked: boolean;
  active: boolean;
  createdAt: string | null;
};

// MULTI-KEY (Sep 2026): satu toko client = satu key sendiri + satu akun
// reseller sendiri (saldo & harga tier terpisah). Bisa dimatikan sementara,
// di-regenerate, atau dihapus per key tanpa ganggu key lain.
export default function PartnerApiSettingsForm() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // id key yang lagi diproses, atau "new"
  const [message, setMessage] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // Nilai asli API Key HANYA ada di state ini tepat setelah dibuat/regenerate
  // -- setelah reload halaman yang ke-load cuma versi masked.
  const [fresh, setFresh] = useState<{ label: string; apiKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit email reseller per baris
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");

  function load() {
    return fetch("/api/admin/settings/partner-api")
      .then((r) => r.json())
      .then((data) => setKeys(data.keys || []));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function call(method: "POST" | "PUT" | "DELETE", body: Record<string, unknown>, busyId: string) {
    setBusy(busyId);
    setMessage(null);
    const res = await fetch("/api/admin/settings/partner-api", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMessage(data.message || "Gagal menyimpan.");
      return null;
    }
    await load();
    return data as { ok: boolean; apiKey?: string };
  }

  async function addKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !newEmail.trim()) {
      setMessage("Nama key dan email reseller wajib diisi.");
      return;
    }
    setFresh(null);
    const data = await call("POST", { label: newLabel.trim(), resellerEmail: newEmail.trim() }, "new");
    if (data?.apiKey) {
      setFresh({ label: newLabel.trim(), apiKey: data.apiKey });
      setNewLabel("");
      setNewEmail("");
      setMessage("API Key baru berhasil dibuat.");
    }
  }

  async function toggleActive(k: KeyRow) {
    await call("PUT", { id: k.id, active: !k.active }, k.id);
  }

  async function regenerate(k: KeyRow) {
    if (!confirm(`Regenerate key "${k.label}"? Key lama langsung mati — toko client harus update ke key baru.`)) return;
    setFresh(null);
    const data = await call("PUT", { id: k.id, regenerate: true }, k.id);
    if (data?.apiKey) {
      setFresh({ label: k.label, apiKey: data.apiKey });
      setMessage("API Key baru berhasil dibuat.");
    }
  }

  async function remove(k: KeyRow) {
    if (!confirm(`Hapus key "${k.label}"? Toko client yang masih pakai key ini langsung gagal (401).`)) return;
    const data = await call("DELETE", { id: k.id }, k.id);
    if (data) setMessage(`Key "${k.label}" dihapus.`);
  }

  async function saveEmail(k: KeyRow) {
    const data = await call("PUT", { id: k.id, resellerEmail: editEmail.trim() }, k.id);
    if (data) {
      setEditingId(null);
      setMessage("Reseller partner tersimpan.");
    }
  }

  function copyKey() {
    if (!fresh) return;
    navigator.clipboard.writeText(fresh.apiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (loading) {
    return <div className="rounded-xl2 border border-border bg-surface p-5 text-[13px] text-ink-faint">Memuat...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl2 border border-border bg-surface p-5">
        <div className="flex items-start gap-2 rounded-lg bg-amber-dim px-3 py-2.5">
          <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber" />
          <p className="text-[11.5px] text-ink-dim">
            Satu toko client = satu API Key, terikat ke satu akun reseller (saldo &amp; harga tier akun itu yang
            dipakai). Client memakainya lewat <span className="font-mono">/api/v1/partner/*</span>. Key yang bocor
            cukup di-regenerate atau dimatikan sendiri, tanpa mengganggu key lain.
          </p>
        </div>
        <a
          href="/docs/api-v1"
          target="_blank"
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary underline"
        >
          <BookOpen size={13} /> Dokumentasi API untuk client
        </a>
      </div>

      {fresh && (
        <div className="rounded-xl2 border border-teal/40 bg-surface p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-teal" />
            <p className="text-[13px] font-bold">Copy sekarang — cuma ditampilkan sekali ({fresh.label})</p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-surface-2 p-3 text-[12px] text-ink">{fresh.apiKey}</code>
            <button
              type="button"
              onClick={copyKey}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-bold text-white"
            >
              <Copy size={13} /> {copied ? "Tersalin!" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            Kirim key ini ke pemilik toko client. Setelah halaman di-reload, key aslinya tidak bisa dilihat lagi —
            cuma versi masked.
          </p>
        </div>
      )}

      <div className="rounded-xl2 border border-border bg-surface">
        <p className="border-b border-border px-5 py-3 text-[13px] font-bold">API Key aktif ({keys.length})</p>
        {keys.length === 0 ? (
          <p className="px-5 py-6 text-center text-[12.5px] text-ink-faint">Belum ada key. Buat yang pertama di bawah.</p>
        ) : (
          <div className="divide-y divide-border">
            {keys.map((k) => (
              <div key={k.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13.5px] font-bold">{k.label}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                      k.active ? "bg-teal/15 text-teal" : "bg-danger/15 text-danger"
                    }`}
                  >
                    {k.active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11.5px] text-ink-faint">{k.apiKeyMasked}</p>

                {editingId === k.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="email reseller"
                      className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-[12px] outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => saveEmail(k)}
                      disabled={busy === k.id}
                      className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
                    >
                      Simpan
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-[12px] text-ink-faint underline">
                      Batal
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 text-[12px] text-ink-dim">
                    Reseller:{" "}
                    {k.resellerLinked ? (
                      <span className="font-mono">{k.resellerEmail || "(akun tidak ditemukan)"}</span>
                    ) : (
                      <span className="text-danger">belum diset</span>
                    )}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(k.id);
                        setEditEmail(k.resellerEmail);
                      }}
                      className="ml-1 text-[11.5px] text-primary underline"
                    >
                      ubah
                    </button>
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(k)}
                    disabled={busy === k.id}
                    className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
                  >
                    {k.active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => regenerate(k)}
                    disabled={busy === k.id}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
                  >
                    <RefreshCw size={12} /> Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(k)}
                    disabled={busy === k.id}
                    className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
                  >
                    <Trash2 size={12} /> Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={addKey} className="rounded-xl2 border border-border bg-surface p-5">
        <p className="text-[13px] font-bold">Tambah key baru</p>
        <div className="mt-3 space-y-3">
          <label className="block text-[11px] font-semibold text-ink-faint">
            Nama key (mis. nama toko client)
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="contoh: RYAN NEW ERA"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
            />
          </label>
          <label className="block text-[11px] font-semibold text-ink-faint">
            Email Reseller (akun partner — saldo akun ini yang kepotong)
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="contoh: ryanxitstore5@gmail.com"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-primary"
            />
          </label>
          <p className="text-[11px] text-ink-faint">
            Harus persis sama dengan email di <a href="/dashboard/admin/resellers" className="underline">Kelola Reseller</a>{" "}
            (gak case-sensitive). Satu akun reseller boleh dipakai beberapa key, tapi kalau mau saldo dan tier
            terpisah per toko, buat akun reseller sendiri per toko.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy === "new"}
            className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
          >
            {busy === "new" ? "Membuat..." : "Generate API Key"}
          </button>
          {message && <span className="text-[11.5px] text-ink-faint">{message}</span>}
        </div>
      </form>
    </div>
  );
}
