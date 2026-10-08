"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import TurnstileWidget, { TURNSTILE_SITE_KEY } from "@/components/TurnstileWidget";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER;
const forgotPasswordHref = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Halo Admin, saya lupa password akun reseller saya")}`
  : undefined;

export default function LoginForm({ next = "/dashboard" }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      // Demo mode -- no backend wired yet, just walk into the dashboard so
      // the UI stays reviewable. Remove this branch once env vars are set.
      router.push(next);
      return;
    }

    if (TURNSTILE_SITE_KEY && !captcha) {
      setError("Selesaikan verifikasi keamanan dulu.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: captcha ? { captchaToken: captcha } : undefined,
      });
      if (signInError) {
        // Generic message on purpose -- confirming "email not found" vs
        // "wrong password" tells an attacker which emails have accounts.
        setError(
          /captcha/i.test(signInError.message)
            ? "Verifikasi keamanan gagal. Coba lagi."
            : "Email atau password salah."
        );
        setCaptchaReset((n) => n + 1); // token sekali pakai -> muat ulang widget
        setLoading(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Gagal login. Coba lagi.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="text-left">
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold text-ink-dim">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@email.com"
          className="w-full rounded-xl border border-border-strong bg-bg px-3.5 py-3 text-[13px] outline-none transition-colors focus:border-primary"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[12px] font-semibold text-ink-dim">Password</span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-border-strong bg-bg px-3.5 py-3 pr-11 text-[13px] outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>

      <TurnstileWidget onToken={setCaptcha} resetKey={captchaReset} />

      <button
        type="submit"
        disabled={loading || (!!TURNSTILE_SITE_KEY && !captcha)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3.5 text-[13.5px] font-bold text-bg transition-transform hover:scale-[1.01] disabled:cursor-wait disabled:opacity-70"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading ? "Memproses..." : "Masuk"}
      </button>

      {error && <p className="mt-3 text-center text-[12px] font-medium text-danger">{error}</p>}

      {!isSupabaseConfigured && (
        <p className="mt-3 text-center text-[11px] text-ink-faint">
          Mode demo — Supabase belum terhubung, form ini langsung masuk ke dashboard.
        </p>
      )}

      <p className="mt-4 text-center text-[11.5px] text-ink-faint">
        Belum punya akun atau lupa password?{" "}
        {forgotPasswordHref ? (
          <Link href={forgotPasswordHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary">
            Hubungi Admin
          </Link>
        ) : (
          <span className="font-semibold">Hubungi Admin</span>
        )}
      </p>
    </form>
  );
}
