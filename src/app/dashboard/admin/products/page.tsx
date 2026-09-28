import PageHeader from "@/components/dashboard/PageHeader";
import NewProductForm from "@/components/dashboard/admin/NewProductForm";
import ProductRow from "@/components/dashboard/admin/ProductRow";
import { getAdminProducts } from "@/lib/data/admin-products";

// FIX (Sep 2026, audit menyeluruh): halaman ini baca data yang berubah-ubah
// (saldo, riwayat, harga tier, dll) lewat Server Component -- tanpa
// force-dynamic, Next.js App Router (v14) bisa nge-cache hasil fetch di
// dalamnya dan nyangkut di data BASI selamanya walau database-nya sudah
// berubah (kejadian nyata: reseller lihat harga lama di /dashboard/generate
// walau tier-nya sudah naik -- lihat riwayat perbaikan di halaman itu).
// Diterapkan ke semua halaman dashboard yang baca data live sebagai
// tindakan pencegahan, bukan cuma yang sudah kebukti kena.
export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const products = await getAdminProducts();

  return (
    <div>
      <PageHeader title="Produk" eyebrow="Admin" back="/dashboard/admin" />

      <NewProductForm />

      {products.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-border p-8 text-center text-[13px] text-ink-faint">
          Belum ada produk. Bikin yang pertama di atas.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl2 border border-border bg-surface">
          {products.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
