import PageHeader from "@/components/dashboard/PageHeader";
import TopupPackagesManager from "@/components/dashboard/admin/TopupPackagesManager";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

// FIX (Sep 2026, audit menyeluruh): halaman ini baca data yang berubah-ubah
// (saldo, riwayat, harga tier, dll) lewat Server Component -- tanpa
// force-dynamic, Next.js App Router (v14) bisa nge-cache hasil fetch di
// dalamnya dan nyangkut di data BASI selamanya walau database-nya sudah
// berubah (kejadian nyata: reseller lihat harga lama di /dashboard/generate
// walau tier-nya sudah naik -- lihat riwayat perbaikan di halaman itu).
// Diterapkan ke semua halaman dashboard yang baca data live sebagai
// tindakan pencegahan, bukan cuma yang sudah kebukti kena.
export const dynamic = 'force-dynamic';

export default async function AdminTopupPackagesPage() {
  const admin_user = await getAdminUser();
  if (!admin_user) redirect("/dashboard");

  const admin = createAdminSupabase();
  const { data } = admin
    ? await admin.from("topup_packages").select("id, nominal, bonus, active, sort_order").order("sort_order")
    : { data: null };

  const packages = (data ?? []).map((p) => ({
    id: p.id,
    nominal: p.nominal,
    bonus: p.bonus,
    active: p.active,
    sortOrder: p.sort_order,
  }));

  return (
    <div>
      <PageHeader title="Paket Top Up" eyebrow="Admin" back="/dashboard/admin" />
      <p className="mb-3 text-[12px] text-ink-faint">
        Nominal & bonus di sini yang muncul di halaman Top Up reseller. Nonaktifkan paket (bukan hapus) kalau
        cuma mau sembunyikan sementara tanpa kehilangan histori.
      </p>
      <TopupPackagesManager initialPackages={packages} />
    </div>
  );
}
