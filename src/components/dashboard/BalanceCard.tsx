import { BadgeCheck, ArrowUpRight, Wallet2 } from "lucide-react";
import Link from "next/link";
import { formatIDR } from "@/lib/format";

export default function BalanceCard({
  balance,
  verified,
  variant = "light",
}: {
  balance: number;
  verified: boolean;
  variant?: "light" | "gradient";
}) {
  if (variant === "gradient") {
    return (
      <div className="relative overflow-hidden rounded-xl2 bg-gradient-to-br from-[#262626] to-[#0a0a0a] p-6 text-white shadow-card">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10"
        />
        <p className="relative text-[11px] font-semibold uppercase tracking-wider text-white/70">
          Total Balance
        </p>
        <p className="relative mt-2 font-display text-[30px] font-extrabold leading-none lg:text-[34px]">
          {formatIDR(balance)}
        </p>
        {verified && (
          <span className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold">
            <BadgeCheck size={14} /> Verified Account
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl2 border border-border bg-surface p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Saldo / Balance
          </p>
          <p className="mt-2 font-display text-[30px] font-extrabold leading-none text-ink lg:text-[34px]">
            {formatIDR(balance)}
          </p>
          {verified && (
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-teal-dim px-3 py-1.5 text-[11px] font-semibold text-teal">
              <BadgeCheck size={14} /> Verified Account
            </span>
          )}
        </div>
        <Link
          href="/dashboard/topup"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-dim text-primary transition-transform hover:scale-105"
          aria-label="Top up saldo"
        >
          <Wallet2 size={19} />
        </Link>
      </div>
      <Link
        href="/dashboard/topup"
        className="mt-5 hidden w-fit items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[12.5px] font-bold text-bg transition-transform hover:scale-[1.03] lg:flex"
      >
        Top Up <ArrowUpRight size={14} />
      </Link>
    </div>
  );
}
