import { redirect } from "next/navigation";
import { Download, Timer } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import BalanceCard from "@/components/dashboard/BalanceCard";
import { getCurrentUser } from "@/lib/data/user";
import { getTopupHistory } from "@/lib/data/activity";
import { formatIDR, formatDateTime } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  success: "bg-teal-dim text-teal",
  pending: "bg-amber-dim text-amber",
  failed: "bg-danger-dim text-danger",
};
const STATUS_LABEL: Record<string, string> = {
  success: "Berhasil",
  pending: "Menunggu",
  failed: "Gagal",
};

export default async function TopupHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const history = await getTopupHistory();

  return (
    <div className="mx-auto max-w-[640px]">
      <PageHeader title="Top-Up History" />

      <BalanceCard balance={user.balance} verified={user.verified} variant="gradient" />

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-display text-[14px] font-bold">Recent Activity</h2>
        <button className="flex items-center gap-1.5 text-[12px] font-semibold text-primary">
          <Download size={13} /> Download PDF
        </button>
      </div>

      {history.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-xl2 border border-border bg-surface py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-dim text-primary">
            <Timer size={24} />
          </span>
          <p className="text-[13px] text-ink-faint">Belum ada transaksi</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {history.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl2 border border-border bg-surface p-4"
            >
              <div>
                <p className="text-[13.5px] font-bold">{formatIDR(t.nominal)}</p>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  {formatDateTime(t.createdAt)} · {t.method}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12.5px] font-bold text-teal">
                  +{formatIDR(t.total)}
                </p>
                <span
                  className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[t.status]}`}
                >
                  {STATUS_LABEL[t.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
