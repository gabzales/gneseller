import PageHeader from "@/components/dashboard/PageHeader";
import TopupPackagesManager from "@/components/dashboard/admin/TopupPackagesManager";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

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
