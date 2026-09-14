import PageHeader from "@/components/dashboard/PageHeader";
import ResellerRow from "@/components/dashboard/admin/ResellerRow";
import NewResellerForm from "@/components/dashboard/admin/NewResellerForm";
import { getAdminResellers } from "@/lib/data/admin-resellers";

// FIX (Sep 2026, audit menyeluruh): halaman ini baca data yang berubah-ubah
// (saldo, riwayat, harga tier, dll) lewat Server Component -- tanpa
// force-dynamic, Next.js App Router (v14) bisa nge-cache hasil fetch di
// dalamnya dan nyangkut di data BASI selamanya walau database-nya sudah
// berubah (kejadian nyata: reseller lihat harga lama di /dashboard/generate
// walau tier-nya sudah naik -- lihat riwayat perbaikan di halaman itu).
// Diterapkan ke semua halaman dashboard yang baca data live sebagai
// tindakan pencegahan, bukan cuma yang sudah kebukti kena.
export const dynamic = 'force-dynamic';

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
