"use client";

import { useEffect, useRef, useState } from "react";
import { Tag, QrCode, Check, Loader2, AlertCircle, X, CheckCircle2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import PageHeader from "@/components/dashboard/PageHeader";
import BalanceCard from "@/components/dashboard/BalanceCard";
import { formatIDR } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type TopupPackage = { nominal: number; bonus: number };

type PendingPayment = {
  reference: string;
  qrString: string;
  amount: number;
};

// Polling interval kept well above GensPay's documented anti-spam
// threshold (30 req / 3 min per user, per their 2026-08 merchant notice)
// -- 5s here means ~36 requests over a 3-minute wait in the worst case,
// but a real payment settles via webhook long before the QR expires, so
// in practice this stays far under the limit for any single top-up.
const POLL_INTERVAL_MS = 5000;

export default function TopupForm({
  balance,
  verified,
  packages,
}: {
  balance: number;
  verified: boolean;
  packages: TopupPackage[];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [paid, setPaid] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pkg = packages.find((p) => p.nominal === selected);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(reference: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/topup/status?ref=${encodeURIComponent(reference)}`);
        if (!res.ok) return; // transient error -- try again next tick, don't surface to user
        const data = await res.json();
        if (data.status === "success") {
          setPaid(true);
          stopPolling();
        } else if (data.status === "expired" || data.status === "failed") {
          stopPolling();
          setPending(null);
          setErrorMsg(
            data.status === "expired"
              ? "QR kadaluarsa sebelum dibayar. Silakan buat transaksi baru."
              : "Pembayaran gagal diproses. Silakan coba lagi."
          );
        }
      } catch {
        // network hiccup -- keep polling, don't spam the user with errors
      }
    }, POLL_INTERVAL_MS);
  }

  async function handlePay() {
    if (!pkg) return;
    setErrorMsg("");

    if (!isSupabaseConfigured) {
      setErrorMsg(
        "Mode demo — Supabase belum terhubung, jadi pembayaran belum bisa diproses sungguhan."
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/topup/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nominal: pkg.nominal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal membuat transaksi.");
      if (data.qrString) {
        setPending({ reference: data.reference, qrString: data.qrString, amount: data.amount });
        setPaid(false);
        startPolling(data.reference);
        return;
      }
      throw new Error("Respons gateway tidak lengkap (QR tidak ditemukan).");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal membuat transaksi.");
    } finally {
      setLoading(false);
    }
  }

  function closeModal() {
    stopPolling();
    setPending(null);
    setPaid(false);
  }

  return (
    <div className="mx-auto max-w-[560px]">
      <PageHeader title="Top Up Saldo" eyebrow="Welcome back" />

      <BalanceCard balance={balance} verified={verified} variant="gradient" />

      <h2 className="mt-6 font-display text-[14px] font-bold">Pilih Nominal</h2>
      <div className="mt-3 flex flex-col gap-2.5">
        {packages.map((p) => {
          const active = selected === p.nominal;
          return (
            <button
              key={p.nominal}
              onClick={() => setSelected(p.nominal)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-colors ${
                active
                  ? "border-primary bg-primary-dim"
                  : "border-border bg-surface hover:border-border-strong"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    active ? "bg-primary text-white" : "bg-surface-2 text-ink-faint"
                  }`}
                >
                  <Tag size={15} />
                </span>
                <div>
                  <p className="text-[13.5px] font-bold">{formatIDR(p.nominal)}</p>
                  {p.bonus > 0 && (
                    <p className="text-[11px] font-medium text-teal">
                      + Bonus {formatIDR(p.bonus)}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-ink-faint">Dapat</p>
                <p className="text-[13px] font-bold">
                  {formatIDR(p.nominal + p.bonus)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <h2 className="mt-6 font-display text-[14px] font-bold">Payment Method</h2>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-primary bg-primary-dim px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-primary">
            <QrCode size={16} />
          </span>
          <div>
            <p className="text-[13px] font-bold">QRIS</p>
            <p className="text-[11px] text-ink-faint">Quick Response Indonesian Standard</p>
          </div>
        </div>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
          <Check size={14} />
        </span>
      </div>

      {errorMsg && (
        <p className="mt-4 flex items-start gap-1.5 text-[12px] font-medium text-danger">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {errorMsg}
        </p>
      )}

      <button
        disabled={!pkg || loading}
        onClick={handlePay}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {pkg ? `Bayar ${formatIDR(pkg.nominal)} via QRIS` : "Pilih nominal dulu"}
      </button>
      <p className="mt-3 text-center text-[11px] text-ink-faint">
        Saldo masuk otomatis setelah pembayaran QRIS terverifikasi lewat webhook —
        biasanya kurang dari 1 menit.
      </p>

      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && paid) closeModal();
          }}
        >
          <div className="w-full max-w-[360px] rounded-2xl bg-surface p-6 text-center shadow-xl">
            {paid ? (
              <>
                <CheckCircle2 size={48} className="mx-auto text-teal" />
                <h3 className="mt-3 font-display text-[16px] font-bold">Pembayaran Berhasil!</h3>
                <p className="mt-1 text-[12.5px] text-ink-faint">
                  Saldo {formatIDR(pending.amount)} sudah masuk ke akun kamu.
                </p>
                <button
                  onClick={closeModal}
                  className="mt-5 w-full rounded-xl bg-primary py-3 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
                >
                  Selesai
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[15px] font-bold">Scan QRIS</h3>
                  <button
                    onClick={closeModal}
                    aria-label="Tutup"
                    className="rounded-lg p-1 text-ink-faint hover:bg-surface-2"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-3">
                  <QRCodeSVG value={pending.qrString} size={200} />
                </div>
                <p className="mt-3 text-[13px] font-bold">{formatIDR(pending.amount)}</p>
                <p className="mt-1 flex items-center justify-center gap-1.5 text-[11.5px] text-ink-faint">
                  <Loader2 size={12} className="animate-spin" /> Menunggu pembayaran...
                </p>
                <p className="mt-3 text-[10.5px] text-ink-faint">
                  Scan pakai aplikasi e-wallet atau m-banking mana pun yang mendukung QRIS.
                  Halaman ini otomatis update begitu pembayaran terverifikasi.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

