"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import TurnstileWidget, { TURNSTILE_SITE_KEY } from "@/components/TurnstileWidget";

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 8) return setMsg({ ok: false, text: "Password baru minimal 8 karakter." });
    if (next !== confirm) return setMsg({ ok: false, text: "Konfirmasi password tidak sama." });
    if (TURNSTILE_SITE_KEY && !captcha) return setMsg({ ok: false, text: "Selesaikan verifikasi keamanan dulu." });

    setBusy(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next, captchaToken: captcha }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg({ ok: res.ok, text: data.message || (res.ok ? "Password berhasil diganti." : "Gagal mengganti password.") });
      if (res.ok) {
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    } catch {
      setMsg({ ok: false, text: "Tidak bisa terhubung ke server." });
    } finally {
      setCaptchaReset((n) => n + 1); // token Turnstile sekali pakai
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-[13px] outline-none transition-colors focus:border-primary";

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl2 border border-border bg-surface p-5">
      <p className="mb-3 flex items-center gap-2 text-[13.5px] font-bold">
        <KeyRound size={16} /> Ganti Password
      </p>
      <div className="space-y-2.5">
        <input className={input} type={show ? "text" : "password"} placeholder="Password lama" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        <input className={input} type={show ? "text" : "password"} placeholder="Password baru (min. 8 karakter)" autoComplete="new-password" minLength={8} required value={next} onChange={(e) => setNext(e.target.value)} />
        <input className={input} type={show ? "text" : "password"} placeholder="Ulangi password baru" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <button type="button" onClick={() => setShow((v) => !v)} className="mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-faint">
        {show ? <EyeOff size={13} /> : <Eye size={13} />} {show ? "Sembunyikan" : "Tampilkan"} password
      </button>
      <TurnstileWidget onToken={setCaptcha} resetKey={captchaReset} />
      <button
        type="submit"
        disabled={busy || (!!TURNSTILE_SITE_KEY && !captcha)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-[13px] font-bold text-bg disabled:cursor-wait disabled:opacity-60"
      >
        {busy && <Loader2 size={15} className="animate-spin" />}
        {busy ? "Memproses..." : "Simpan Password Baru"}
      </button>
      {msg && <p className={`mt-3 text-center text-[12px] font-medium ${msg.ok ? "text-teal" : "text-danger"}`}>{msg.text}</p>}
    </form>
  );
}
