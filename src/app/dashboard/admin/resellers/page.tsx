import PageHeader from "@/components/dashboard/PageHeader";
import ResellerRow from "@/components/dashboard/admin/ResellerRow";
import NewResellerForm from "@/components/dashboard/admin/NewResellerForm";
import { getAdminResellers } from "@/lib/data/admin-resellers";

export default async function AdminResellersPage() {
  const resellers = await getAdminResellers();

  return (
    <div>
      <PageHeader title="Kelola Reseller" eyebrow="Admin" back="/dashboard/admin" />

      <NewResellerForm />

      <p className="mb-3 text-[12px] text-ink-faint">
        Nambah saldo di sini langsung masuk saldo reseller + tercatat di History Top Up mereka sebagai
        &quot;MANUAL&quot; (gak lewat GensPay). Nominal bebas, gak ada batas atas.
      </p>

      {resellers.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-border p-8 text-center text-[13px] text-ink-faint">
          Belum ada reseller.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl2 border border-border bg-surface">
          {resellers.map((r) => (
            <ResellerRow key={r.id} reseller={r} />
          ))}
        </div>
      )}
    </div>
  );
}
