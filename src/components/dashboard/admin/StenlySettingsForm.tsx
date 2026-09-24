"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

type ActiveGateway = "genspay" | "stenly";

export default function StenlySettingsForm() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookSecretMasked, setWebhookSecretMasked] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [configured, setConfigured] = useState(false);
  const [activeGateway, setActiveGateway] = useState<ActiveGateway>("genspay");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    return fetch("/api/admin/settings/stenly")
      .then((r) => r.json())
      .then((data) => {
        setBaseUrl(data.baseUrl);
        setApiKeyMasked(data.apiKeyMasked);
        setWebhookSecretMasked(data.webhookSecretMasked);
        setConfigured(data.configured);
        setActiveGateway(data.activeGateway);
      });
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent, gatewayOverride?: ActiveGateway) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/settings/stenly", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl, apiKey, webhookSecret, activeGateway: gatewayOverride ?? activeGateway }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMessage("Kredensial tersimpan.");
      setApiKey("");
      setWebhookSecret("");
      await load();
    } else {
      setMessage(data.message || "Gagal menyimpan.");
    }
  }

  async function switchGateway(gw: ActiveGateway) {
    if (gw === activeGateway) return;
    setActiveGateway(gw);
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/settings/stenly", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeGateway: gw }),
    });
    setBusy(false);
    if (res.ok) {
      setMessage(`Gateway aktif sekarang: ${gw === "stenly" ? "stenly.id" : "GensPay"}.`);
    } else {
      setMessage("Gagal ganti gateway aktif.");
      await load(); // revert toggle kalau gagal
    }
  }

  if (loading) {
    return <div className="rounded-xl2 border border-border bg-surface p-5 text-[13px] text-ink-faint">Memuat...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toggle gateway aktif -- satu saklar dipakai bareng oleh checkout
          topup (topup/create/route.ts) dan webhook. Cuma satu yang boleh
          aktif dalam satu waktu, sama seperti pola "Pengaturan QRIS" di
          GNE. */}
      <div className="rounded-xl2 border border-border bg-surface p-5">
        <p className="mb-3 text-[13px] font-bold">Gateway Pembayaran Aktif</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => switchGateway("genspay")}
            disabled={busy}
            className={`flex-1 rounded-lg border px-4 py-2.5 text-[12.5px] font-bold transition-colors ${
              activeGateway === "genspay"
                ? "border-primary bg-primary-dim text-primary"
                : "border-border bg-surface-2 text-ink-faint"
            }`}
          >
            GensPay
          </button>
          <button
            type="button"
            onClick={() => switchGateway("stenly")}
            disabled={busy}
            className={`flex-1 rounded-lg border px-4 py-2.5 text-[12.5px] font-bold transition-colors ${
              activeGateway === "stenly"
                ? "border-primary bg-primary-dim text-primary"
                : "border-border bg-surface-2 text-ink-faint"
            }`}
          >
            stenly.id
          </button>
        </div>
        <p className="mt-2 text-[11px] text-ink-faint">
          Hanya satu gateway yang aktif untuk checkout top up saldo. Pastikan kredensial gateway yang dipilih sudah
          diisi di bawah sebelum diaktifkan.
        </p>
      </div>

      <form onSubmit={save} className="rounded-xl2 border border-border bg-surface p-5">
        <div className="flex items-start gap-2 rounded-lg bg-amber-dim px-3 py-2.5">
          <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber" />
          <p className="text-[11.5px] text-ink-dim">
            Secret Key dipakai untuk membuat charge QRIS; Webhook Secret dipakai untuk memverifikasi callback
            pembayaran. Dua kredensial ini berbeda (lihat dashboard stenly.id) — jangan tertukar.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-[11px] font-semibold text-ink-faint">
            Base URL
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://stenly.id/api/v1"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
            />
          </label>
          <label className="block text-[11px] font-semibold text-ink-faint">
            Secret Key {apiKeyMasked && <span className="text-ink-faint">(saat ini: {apiKeyMasked})</span>}
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={apiKeyMasked ? "Kosongkan kalau tidak diganti" : "sk_live_..."}
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-primary"
            />
          </label>
          <label className="block text-[11px] font-semibold text-ink-faint">
            Webhook Secret{" "}
            {webhookSecretMasked && <span className="text-ink-faint">(saat ini: {webhookSecretMasked})</span>}
            <input
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={webhookSecretMasked ? "Kosongkan kalau tidak diganti" : "whsec_..."}
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-primary"
            />
          </label>
          <p className="text-[11px] text-ink-faint">
            Daftarkan Callback URL di dashboard stenly.id ke:{" "}
            <span className="font-mono text-ink-dim">{"{domain-toko-ini}"}/api/webhooks/stenly</span>
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
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
    </div>
  );
}
