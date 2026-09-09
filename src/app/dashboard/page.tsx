import { KeyRound, History, Wallet, Receipt, ChevronRight, Bell } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import PageHeader from "@/components/dashboard/PageHeader";
import BalanceCard from "@/components/dashboard/BalanceCard";
import ServiceCard from "@/components/dashboard/ServiceCard";
import Avatar from "@/components/Avatar";
import { getCurrentUser } from "@/lib/data/user";
import { getKeyHistory, getTopupHistory } from "@/lib/data/activity";
import { formatIDR, formatDateTime, greeting } from "@/lib/format";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [keyHistory, topupHistory] = await Promise.all([
    getKeyHistory(),
    getTopupHistory(),
  ]);

  const recent = [
    ...keyHistory.slice(0, 2).map((k) => ({
      id: k.id,
      label: `${k.productName} · ${k.duration}`,
      meta: formatDateTime(k.createdAt),
      tone: "primary" as const,
    })),
    ...topupHistory.slice(0, 2).map((t) => ({
      id: t.id,
      label: `Top up ${formatIDR(t.nominal)}`,
      meta: formatDateTime(t.createdAt),
      tone: "teal" as const,
    })),
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-4 lg:hidden">
        <div>
          <p className="text-[13px] text-ink-faint">{greeting()},</p>
          <h1 className="font-display text-[20px] font-bold">{user.name}!</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-dim"
            aria-label="Notifikasi"
          >
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose" />
            <Bell size={17} />
          </button>
          <Avatar seed={user.avatarSeed} name={user.name} size={38} />
        </div>
      </div>

      <div className="hidden lg:block">
        <PageHeader eyebrow={greeting()} title={`${user.name}!`} back={null} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:mt-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          <BalanceCard balance={user.balance} verified={user.verified} />

          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15px] font-bold">Services</h2>
            <span className="text-[12px] font-medium text-primary">See all</span>
          </div>

          <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
            <ServiceCard
              href="/dashboard/generate"
              title="Generate Keys"
              subtitle="Create new access"
              icon={KeyRound}
              tone="primary"
            />
            <ServiceCard
              href="/dashboard/history/keys"
              title="History Key"
              subtitle="View past keys"
              icon={History}
              tone="rose"
            />
            <ServiceCard
              href="/dashboard/topup"
              title="Top Up"
              subtitle="Add balance"
              icon={Wallet}
              tone="teal"
            />
            <ServiceCard
              href="/dashboard/history/topup"
              title="History Top Up"
              subtitle="Transaction logs"
              icon={Receipt}
              tone="amber"
            />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-xl2 border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[14px] font-bold">Recent Activity</h2>
              <Link
                href="/dashboard/calendar"
                className="flex items-center text-[12px] font-medium text-primary"
              >
                Calendar <ChevronRight size={14} />
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="mt-4 text-[12px] text-ink-faint">Belum ada aktivitas.</p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {recent.map((r) => (
                  <li key={r.tone + r.id} className="flex items-center gap-3 py-3">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        r.tone === "primary" ? "bg-primary" : "bg-teal"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-ink">
                        {r.label}
                      </p>
                      <p className="text-[11px] text-ink-faint">{r.meta}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl2 border border-border bg-surface p-5">
            <h2 className="font-display text-[14px] font-bold">Ringkasan Bulan Ini</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-2 p-3.5">
                <p className="text-[11px] text-ink-faint">Key dibuat</p>
                <p className="mt-1 font-display text-[18px] font-bold">
                  {keyHistory.length}
                </p>
              </div>
              <div className="rounded-xl bg-surface-2 p-3.5">
                <p className="text-[11px] text-ink-faint">Top up sukses</p>
                <p className="mt-1 font-display text-[18px] font-bold">
                  {topupHistory.filter((t) => t.status === "success").length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
