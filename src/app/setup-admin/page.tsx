"use client";

import { useState } from "react";
import Link from "next/link";
import TurnstileWidget, { TURNSTILE_SITE_KEY } from "@/components/TurnstileWidget";

export default function SetupAdminPage() {
  const [form, setForm] = useState({ secret: "", name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/setup-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, captchaToken: captcha }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg({ ok: res.ok, text: data.message || (res.ok ? "Berhasil." : "Gagal.") });
      if (res.ok) setForm({ secret: "", name: "", email: "", password: "" });
    } catch {
      setMsg({ ok: false, text: "Tidak bisa terhubung ke server." });
    } finally {
      setCaptchaReset((n) => n + 1);
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-primary";

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-[400px] space-y-3 rounded-2xl border border-border bg-surface p-6">
        <h1 className="font-display text-lg font-bold">Setup Admin Pertama</h1>
        <p className="text-[12px] text-ink-faint">
          Isi kode rahasia (SETUP_ADMIN_SECRET di Vercel). Hanya bisa dipakai selama belum ada admin.
        </p>
        <input className={input} type="password" placeholder="Kode rahasia" autoComplete="off" required
          value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
        <input className={input} placeholder="Nama admin" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={input} type="email" placeholder="Email" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className={input} type="password" placeholder="Password (min. 8 karakter)" minLength={8} required
          autoComplete="new-password" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <TurnstileWidget onToken={setCaptcha} resetKey={captchaReset} />
        <button disabled={busy || (!!TURNSTILE_SITE_KEY && !captcha)} type="submit"
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60">
          {busy ? "Memproses…" : "Buat Admin"}
        </button>
        {msg && (
          <p className={`text-[12px] ${msg.ok ? "text-teal" : "text-danger"}`}>
            {msg.text} {msg.ok && <Link href="/login" className="underline">Ke halaman login</Link>}
          </p>
        )}
      </form>
    </div>
  );
}
