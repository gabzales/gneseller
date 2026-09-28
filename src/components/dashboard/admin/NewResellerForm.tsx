"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Check } from "lucide-react";

type CreatedResult = {
  email: string;
  fullName: string;
  balance: number;
  password: string | null;
};

export default function NewResellerForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/resellers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fullName,
          password: password || undefined,
          initialBalance: Number(initialBalance) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal membuat reseller.");
      setResult({ email: data.email, fullName: data.fullName, balance: data.balance, password: data.password });
      setEmail("");
      setFullName("");
      setPassword("");
      setInitialBalance("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function copyCreds() {
    if (!result) return;
    const text = `Email: ${result.email}${result.password ? `\nPassword: ${result.password}` : ""}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (!open && !result) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-3 flex items-center gap-1.5 rounded-xl2 bg-primary px-4 py-2.5 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
      >
        <Plus size={15} /> Tambah Reseller
      </button>
    );
  }

  if (result) {
    return (
      <div className="mb-4 rounded-xl2 border border-teal/40 bg-teal/10 p-4">
        <p className="text-[13px] font-bold text-teal">Akun reseller dibuat</p>
        <p className="mt-1 text-[12.5px] text-ink-dim">{result.fullName} · {result.email}</p>
        {result.password && (
          <p className="mt-1 text-[12.5px] text-ink-dim">
            Password: <span className="font-mono font-bold">{result.password}</span>
          </p>
        )}
        <p className="mt-1 text-[11.5px] text-ink-faint">
          Simpan/kirim kredensial ini sekarang -- password tidak ditampilkan lagi setelah ini.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={copyCreds}
            className="flex items-center gap-1.5 rounded-lg bg-teal px-3 py-1.5 text-[12px] font-bold text-white"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Tersalin" : "Salin"}
          </button>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setOpen(false);
            }}
            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-ink-dim hover:bg-surface-2"
          >
            Selesai
          </button>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setOpen(true);
            }}
            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary-dim"
          >
            Tambah lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-xl2 border border-border bg-surface p-4">
      <p className="text-[13px] font-bold">Reseller Baru</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary"
        />
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nama lengkap"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (kosongkan = auto-generate)"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary"
        />
        <input
          type="number"
          min={0}
          value={initialBalance}
          onChange={(e) => setInitialBalance(e.target.value)}
          placeholder="Saldo awal (opsional)"
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
          {busy ? "Membuat..." : "Buat Akun"}
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
