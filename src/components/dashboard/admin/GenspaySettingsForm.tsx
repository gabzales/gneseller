"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, CheckCircle2, XCircle, PlayCircle } from "lucide-react";

type TestStep = { step: string; ok: boolean; detail: string };
type TestResult = {
  ok: boolean;
  steps: TestStep[];
  httpStatus?: number;
  elapsedMs?: number;
  rawResponse?: string;
};

export default function GenspaySettingsForm() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  function load() {
    return fetch("/api/admin/settings/genspay")
      .then((r) => r.json())
      .then((data) => {
        setBaseUrl(data.baseUrl);
        setApiKeyMasked(data.apiKeyMasked);
        setConfigured(data.configured);
      });
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setTestResult(null);
    const res = await fetch("/api/admin/settings/genspay", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl, apiKey }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMessage("Kredensial tersimpan.");
      setApiKey("");
      await load();
    } else {
      setMessage(data.message || "Gagal menyimpan.");
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings/genspay/test", { method: "POST" });
      const data: TestResult = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, steps: [{ step: "network", ok: false, detail: "Tidak bisa memanggil endpoint test." }] });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl2 border border-border bg-surface p-5 text-[13px] text-ink-faint">Memuat...</div>;
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="rounded-xl2 border border-border bg-surface p-5">
        <div className="flex items-start gap-2 rounded-lg bg-amber-dim px-3 py-2.5">
          <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber" />
          <p className="text-[11.5px] text-ink-dim">
            API Key ini dipakai untuk membuat transaksi QRIS dan memverifikasi webhook GensPay. Kalau pernah bocor,
            regenerate dulu dari dashboard GensPay sebelum dipakai lagi di sini.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-[11px] font-semibold text-ink-faint">
            Base URL
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://genspay.my.id/api/v1"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
            />
          </label>
          <label className="block text-[11px] font-semibold text-ink-faint">
            API Key {apiKeyMasked && <span className="text-ink-faint">(saat ini: {apiKeyMasked})</span>}
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={apiKeyMasked ? "Kosongkan kalau tidak diganti" : "Isi API Key dari dashboard GensPay"}
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
          >
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
          <button
            type="button"
            onClick={runTest}
            disabled={testing}
            className="flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
          >
            <PlayCircle size={14} /> {testing ? "Menguji..." : "Test & Debug"}
          </button>
          <span className={`text-[11.5px] font-semibold ${configured ? "text-teal" : "text-danger"}`}>
            {configured ? "Terhubung" : "Belum dikonfigurasi"}
          </span>
          {message && <span className="text-[11.5px] text-ink-faint">{message}</span>}
        </div>
      </form>

      {testResult && (
        <div className="rounded-xl2 border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            {testResult.ok ? (
              <CheckCircle2 size={16} className="text-teal" />
            ) : (
              <XCircle size={16} className="text-danger" />
            )}
            <p className="text-[13px] font-bold">
              {testResult.ok ? "Koneksi GensPay OK" : "Ada masalah di koneksi GensPay"}
            </p>
            {typeof testResult.httpStatus === "number" && (
              <span className="text-[11.5px] text-ink-faint">
                HTTP {testResult.httpStatus} · {testResult.elapsedMs}ms
              </span>
            )}
          </div>

          <ol className="mt-3 space-y-2">
            {testResult.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px]">
                {s.ok ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-teal" />
                ) : (
                  <XCircle size={14} className="mt-0.5 shrink-0 text-danger" />
                )}
                <span>
                  <span className="font-mono font-semibold text-ink-faint">{s.step}</span>{" "}
                  <span className="text-ink-dim">— {s.detail}</span>
                </span>
              </li>
            ))}
          </ol>

          {testResult.rawResponse && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[11.5px] font-semibold text-ink-faint">
                Raw response dari GensPay
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 text-[11px] text-ink-dim">
                {testResult.rawResponse}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
