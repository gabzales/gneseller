"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

export default function ProviderSettingsForm() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [apiSecretMasked, setApiSecretMasked] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings/provider")
      .then((r) => r.json())
      .then((data) => {
        setBaseUrl(data.baseUrl);
        setApiKeyMasked(data.apiKeyMasked);
        setApiSecretMasked(data.apiSecretMasked);
        setConfigured(data.configured);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/settings/provider", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl, apiKey, apiSecret }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMessage("Kredensial tersimpan.");
      setApiKey("");
      setApiSecret("");
      const refreshed = await fetch("/api/admin/settings/provider").then((r) => r.json());
      setApiKeyMasked(refreshed.apiKeyMasked);
      setApiSecretMasked(refreshed.apiSecretMasked);
      setConfigured(refreshed.configured);
    } else {
      setMessage(data.message || "Gagal menyimpan.");
    }
  }

  if (loading) return <div className="rounded-xl2 border border-border bg-surface p-5 text-[13px] text-ink-faint">Memuat...</div>;

  return (
    <form onSubmit={save} className="rounded-xl2 border border-border bg-surface p-5">
      <div className="flex items-start gap-2 rounded-lg bg-amber-dim px-3 py-2.5">
        <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber" />
        <p className="text-[11.5px] text-ink-dim">
          API Key/Secret bisa dipakai motong saldo reseller di vipibmstore.com. Kalau pernah bocor, regenerate
          dulu dari dashboard provider sebelum dipakai lagi di sini.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block text-[11px] font-semibold text-ink-faint">
          Base URL
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
          />
        </label>
        <label className="block text-[11px] font-semibold text-ink-faint">
          API Key {apiKeyMasked && <span className="text-ink-faint">(saat ini: {apiKeyMasked})</span>}
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={apiKeyMasked ? "Kosongkan kalau tidak diganti" : "Isi API Key"}
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-primary"
          />
        </label>
        <label className="block text-[11px] font-semibold text-ink-faint">
          API Secret {apiSecretMasked && <span className="text-ink-faint">(saat ini: {apiSecretMasked})</span>}
          <input
            type="password"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            placeholder={apiSecretMasked ? "Kosongkan kalau tidak diganti" : "Isi API Secret"}
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-primary"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
        >
          {busy ? "Menyimpan..." : "Simpan"}
        </button>
        <span className={`text-[11.5px] font-semibold ${configured ? "text-teal" : "text-danger"}`}>
          {configured ? "Terhubung" : "Belum dikonfigurasi"}
        </span>
        {message && <span className="text-[11.5px] text-ink-faint">{message}</span>}
      </div>
    </form>
  );
}
