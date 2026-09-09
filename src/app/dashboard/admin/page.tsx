import Link from "next/link";
import { Package, Settings, ArrowRight, KeyRound, Users, Wallet, Megaphone, History } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import { createAdminSupabase } from "@/lib/supabase/admin";

async function getStats() {
  const admin = createAdminSupabase();
  if (!admin) return { products: 0, activeProducts: 0, keysSold: 0, resellers: 0 };

  const [{ count: products }, { count: activeProducts }, { count: keysSold }, { count: resellers }] =
    await Promise.all([
      admin.from("products").select("id", { count: "exact", head: true }),
      admin.from("products").select("id", { count: "exact", head: true }).eq("active", true),
      admin.from("reseller_keys").select("id", { count: "exact", head: true }),
      admin.from("users").select("id", { count: "exact", head: true }).eq("role", "user"),
    ]);

  return {
    products: products ?? 0,
    activeProducts: activeProducts ?? 0,
    keysSold: keysSold ?? 0,
    resellers: resellers ?? 0,
  };
}

export default async function AdminOverviewPage() {
  const stats = await getStats();

  return (
    <div>
      <PageHeader title="Admin" eyebrow="Panel" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Package} label="Produk" value={stats.products} sub={`${stats.activeProducts} aktif`} />
        <StatCard icon={KeyRound} label="Key Terjual" value={stats.keysSold} />
        <StatCard icon={Users} label="Reseller" value={stats.resellers} />
      </div>

      <div className="mt-4 divide-y divide-border rounded-xl2 border border-border bg-surface">
        <Link
          href="/dashboard/admin/products"
          className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-dim text-primary">
            <Package size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold">Kelola Produk</p>
            <p className="text-[11.5px] text-ink-faint">Tambah, edit, hapus produk & stok key</p>
          </div>
          <ArrowRight size={16} className="text-ink-faint" />
        </Link>
        <Link
          href="/dashboard/admin/resellers"
          className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-dim text-primary">
            <Users size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold">Kelola Reseller</p>
            <p className="text-[11.5px] text-ink-faint">Tambah/kurangi saldo manual, di luar QRIS</p>
          </div>
          <ArrowRight size={16} className="text-ink-faint" />
        </Link>
        <Link
          href="/dashboard/admin/settings"
          className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-dim text-primary">
            <Settings size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold">Reseller API</p>
            <p className="text-[11.5px] text-ink-faint">Kredensial vipibmstore.com buat mode Auto</p>
          </div>
          <ArrowRight size={16} className="text-ink-faint" />
        </Link>
        <Link
          href="/dashboard/admin/settings/genspay"
          className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-dim text-primary">
            <Wallet size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold">GensPay</p>
            <p className="text-[11.5px] text-ink-faint">Kredensial payment gateway QRIS + test/debug</p>
          </div>
          <ArrowRight size={16} className="text-ink-faint" />
        </Link>
        <Link
          href="/dashboard/admin/topup-packages"
          className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-dim text-primary">
            <Wallet size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold">Paket Top Up</p>
            <p className="text-[11.5px] text-ink-faint">Edit nominal & bonus paket top up</p>
          </div>
          <ArrowRight size={16} className="text-ink-faint" />
        </Link>
        <Link
          href="/dashboard/admin/broadcasts"
          className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-dim text-primary">
            <Megaphone size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold">Broadcast Notifikasi</p>
            <p className="text-[11.5px] text-ink-faint">Kirim pengumuman ke semua reseller</p>
          </div>
          <ArrowRight size={16} className="text-ink-faint" />
        </Link>
        <Link
          href="/dashboard/admin/key-history"
          className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-dim text-primary">
            <History size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold">Riwayat Key</p>
            <p className="text-[11.5px] text-ink-faint">Lihat key yang digenerate lintas semua reseller</p>
          </div>
          <ArrowRight size={16} className="text-ink-faint" />
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Package;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl2 border border-border bg-surface p-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-dim text-primary">
        <Icon size={15} />
      </span>
      <p className="mt-3 font-display text-[20px] font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11.5px] text-ink-faint">
        {label}
        {sub ? ` · ${sub}` : ""}
      </p>
    </div>
  );
}
