"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, CheckCircle2, Copy } from "lucide-react";

export default function PartnerApiSettingsForm() {
  // Pakai email, BUKAN UUID -- satu-satunya identitas akun reseller yang
  // beneran keliatan di halaman Kelola Reseller cuma nama & email, admin
  // gak punya cara gampang buat lihat UUID mentahnya. Route PUT di
  // belakang yang resolve email -> id sebelum disimpan ke app_settings.
  const [resellerEmail, setResellerEmail] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Nilai asli API Key HANYA ada di state ini tepat setelah generate/regenerate
  // berhasil -- lihat komentar di route PUT /api/admin/settings/partner-api.
  // Setelah reload halaman, ini selalu kosong lagi (yang ke-load cuma versi masked).
  const [freshApiKey, setFreshApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function load() {
    return fetch("/api/admin/settings/partner-api")
      .then((r) => r.json())
      .then((data) => {
        setApiKeyMasked(data.apiKeyMasked || "");
        setResellerEmail(data.resellerEmail || "");
        setConfigured(Boolean(data.configured));
      });
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent, regenerate: boolean) {
    e.preventDefault();
    if (!resellerEmail.trim()) {
      setMessage("Email reseller wajib diisi dulu.");
      return;
    }
    setBusy(true);
    setMessage(null);
    setFreshApiKey(null);
    const res = await fetch("/api/admin/settings/partner-api", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resellerEmail: resellerEmail.trim(), regenerate }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMessage(regenerate || data.apiKey ? "API Key baru berhasil dibuat." : "Reseller partner tersimpan.");
      if (data.apiKey) setFreshApiKey(data.apiKey);
      await load();
    } else {
      setMessage(data.message || "Gagal menyimpan.");
    }
  }

  function copyKey() {
    if (!freshApiKey) return;
    navigator.clipboard.writeText(freshApiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (loading) {
    return <div className="rounded-xl2 border border-border bg-surface p-5 text-[13px] text-ink-faint">Memuat...</div>;
  }

  return (
    <div className="space-y-4">
      <form className="rounded-xl2 border border-border bg-surface p-5">
        <div className="flex items-start gap-2 rounded-lg bg-amber-dim px-3 py-2.5">
          <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber" />
          <p className="text-[11.5px] text-ink-dim">
            API Key ini dipakai toko client lain (mis. RYAN NEW ERA) buat auto-generate key lewat{" "}
            <span className="font-mono">/api/v1/partner/generate-key</span>, ditagih ke saldo akun reseller yang
            dipilih di bawah. Kalau pernah bocor, klik <span className="font-semibold">Regenerate</span> — key lama
            langsung mati seketika.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-[11px] font-semibold text-ink-faint">
            Email Reseller (akun partner — saldo akun ini yang kepotong)
            <input
              value={resellerEmail}
              onChange={(e) => setResellerEmail(e.target.value)}
              placeholder="contoh: ryanxitstore5@gmail.com"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-primary"
            />
          </label>
          <p className="text-[11px] text-ink-faint">
            Harus persis sama dengan email yang keliatan di{" "}
            <a href="/dashboard/admin/resellers" className="underline">Kelola Reseller</a> (di bawah nama, huruf kecil
            semua juga gapapa — gak case-sensitive).
          </p>

          <label className="block text-[11px] font-semibold text-ink-faint">
            API Key {apiKeyMasked && <span className="text-ink-faint">(saat ini: {apiKeyMasked})</span>}
            <div className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink-faint">
              {apiKeyMasked || "Belum ada — klik Generate di bawah"}
            </div>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={(e) => save(e, false)}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
          >
            {busy ? "Menyimpan..." : configured ? "Simpan Reseller Partner" : "Generate API Key"}
          </button>
          {configured && (
            <button
              type="button"
              onClick={(e) => save(e, true)}
              disabled={busy}
              className="rounded-lg bg-danger px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
            >
              Regenerate (matikan key lama)
            </button>
          )}
          <span className={`text-[11.5px] font-semibold ${configured ? "text-teal" : "text-danger"}`}>
            {configured ? "Terhubung" : "Belum dikonfigurasi"}
          </span>
          {message && <span className="text-[11.5px] text-ink-faint">{message}</span>}
        </div>
      </form>

      {freshApiKey && (
        <div className="rounded-xl2 border border-teal/40 bg-surface p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-teal" />
            <p className="text-[13px] font-bold">Copy sekarang — cuma ditampilkan sekali</p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-surface-2 p-3 text-[12px] text-ink">
              {freshApiKey}
            </code>
            <button
              type="button"
              onClick={copyKey}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-bold text-white"
            >
              <Copy size={13} /> {copied ? "Tersalin!" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            Tempel key ini di panel admin toko client (mis. RYAN NEW ERA → Pengaturan → GhostSeller Auto-Restock).
            Setelah halaman ini di-reload, key aslinya tidak bisa dilihat lagi — cuma versi masked.
          </p>
        </div>
      )}
    </div>
  );
}
