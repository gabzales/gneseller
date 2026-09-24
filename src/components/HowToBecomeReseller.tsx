"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MessageCircle,
  ArrowUpRight,
  Rocket,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  KeyRound,
} from "lucide-react";
import Avatar from "@/components/Avatar";

// Admin sets/rotates this in hosting env vars -- see .env.example
// (NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER). No fallback number is hardcoded
// here on purpose: a wrong/expired number silently sending customers to a
// stranger's WhatsApp is worse than the button visibly needing setup.
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER;
const WHATSAPP_MESSAGE = "Halo Admin, saya ingin daftar reseller";
const whatsappHref = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`
  : undefined;

const STEPS = [
  { num: "01", icon: MessageCircle, title: "Daftarkan Akun Reseller" },
  { num: "02", icon: ArrowUpRight, title: "Login Website" },
  { num: "03", icon: Rocket, title: "Mulai Gunakan" },
];

const AVATAR_PREVIEW = [
  { seed: "r1", name: "Dian Saputra" },
  { seed: "r2", name: "Mega Utami" },
  { seed: "r3", name: "Fajar Ramadhan" },
  { seed: "r4", name: "Nina Kartika" },
];

export default function HowToBecomeReseller() {
  const [step, setStep] = useState(0);
  const last = STEPS.length - 1;
  const active = STEPS[step];

  return (
    <section className="border-t border-border bg-surface-2/60" id="jadi-reseller">
      <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8">
        <div className="text-center">
          <h2 className="font-display text-[22px] font-bold sm:text-[26px]">
            Cara Jadi Reseller
          </h2>
          <p className="mt-2 text-[13px] text-ink-dim">Tiga cara jadi reseller kami</p>
        </div>

        <div className="mx-auto mt-10 grid max-w-[560px] grid-cols-1 items-center gap-6 lg:max-w-[640px] lg:grid-cols-[auto_1fr]">
          <div className="flex items-center justify-center gap-3 lg:flex-col lg:items-start">
            <span className="font-display text-[40px] font-extrabold text-ink-faint sm:text-[52px]">
              {active.num}
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-ink lg:h-10 lg:w-10">
              <active.icon size={17} />
            </span>
          </div>

          <div className="mx-auto w-full max-w-[380px] lg:mx-0 lg:max-w-none">
            <h3 className="mb-3 font-display text-[15px] font-bold">{active.title}</h3>

            {step === 0 && (
              <div className="overflow-hidden rounded-xl2 border border-border bg-ink">
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <Avatar seed="admin-reseller" name="Admin Reseller" size={30} />
                  <div>
                    <p className="text-[12.5px] font-bold text-white">Admin Reseller</p>
                    <p className="flex items-center gap-1 text-[10.5px] text-white/50">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal" /> Online
                    </p>
                  </div>
                </div>
                <div className="space-y-2.5 bg-surface px-4 py-4">
                  <p className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-ink px-3.5 py-2.5 text-[12px] text-white">
                    {WHATSAPP_MESSAGE}
                  </p>
                  <p className="flex max-w-[85%] items-start gap-1.5 rounded-xl rounded-tl-sm bg-surface-2 px-3.5 py-2.5 text-[12px] text-ink-dim">
                    Silakan kirim Nama, Email, dan No. WhatsApp Anda.
                    <Check size={13} className="mt-0.5 shrink-0 text-teal" />
                  </p>
                  <p className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-ink px-3.5 py-2.5 text-[12px] text-white">
                    Baik, saya kirim sekarang
                  </p>
                  {whatsappHref ? (
                    <Link
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-ink py-3 text-[13px] font-bold text-white transition-transform hover:scale-[1.01]"
                    >
                      <MessageCircle size={16} /> Mulai Chat via WhatsApp
                    </Link>
                  ) : (
                    <p className="mt-1 rounded-xl border border-dashed border-border-strong py-3 text-center text-[11.5px] text-ink-faint">
                      Nomor WhatsApp admin belum diatur.
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="overflow-hidden rounded-xl2 border border-border bg-surface">
                <div className="flex items-center gap-1 border-b border-border px-4 py-3 text-[11px] font-semibold text-ink-faint">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] text-white">
                    1
                  </span>
                  <span className="text-ink">Login</span>
                  <span className="mx-1.5 h-px w-4 bg-border-strong" />
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-2">
                    2
                  </span>
                  <span>Dashboard</span>
                  <span className="mx-1.5 h-px w-4 bg-border-strong" />
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-2">
                    3
                  </span>
                  <span>Selesai</span>
                </div>
                <div className="flex flex-col items-center px-6 py-7 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink">
                    <KeyRound size={20} />
                  </span>
                  <p className="mt-4 max-w-[280px] text-[12px] leading-relaxed text-ink-dim">
                    Login pakai email &amp; password yang diberikan admin lewat WhatsApp. Akses
                    dashboard dan kelola bisnis Anda.
                  </p>
                  <Link
                    href="/login"
                    className="mt-4 flex items-center justify-center gap-2.5 rounded-xl bg-ink px-5 py-2.5 text-[12.5px] font-semibold text-bg transition-transform hover:scale-[1.02]"
                  >
                    <KeyRound size={15} />
                    Masuk ke Dashboard
                  </Link>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col items-center rounded-xl2 border border-border bg-surface px-6 py-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-dim text-teal">
                  <CheckCircle2 size={22} />
                </span>
                <p className="mt-4 font-display text-[15px] font-bold">Selamat!</p>
                <p className="mt-1.5 max-w-[260px] text-[12px] leading-relaxed text-ink-dim">
                  Anda sudah bergabung bersama beberapa reseller lainnya
                </p>
                <div className="mt-4 flex items-center">
                  {AVATAR_PREVIEW.map((a, i) => (
                    <span
                      key={a.seed}
                      className="-ml-2 rounded-full ring-2 ring-surface first:ml-0"
                      style={{ zIndex: AVATAR_PREVIEW.length - i }}
                    >
                      <Avatar seed={a.seed} name={a.name} size={30} />
                    </span>
                  ))}
                  <span className="-ml-2 flex h-[30px] items-center justify-center rounded-full bg-surface-2 px-2.5 text-[10.5px] font-bold text-ink-dim ring-2 ring-surface">
                    +128
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Sebelumnya"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-dim transition-opacity disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.num}
                type="button"
                aria-label={`Langkah ${i + 1}`}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-ink" : "w-1.5 bg-border-strong"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Selanjutnya"
            onClick={() => setStep((s) => Math.min(last, s + 1))}
            disabled={step === last}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-dim transition-opacity disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
