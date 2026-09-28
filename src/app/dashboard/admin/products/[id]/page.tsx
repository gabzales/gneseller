import { notFound } from "next/navigation";
import PageHeader from "@/components/dashboard/PageHeader";
import ProductEditor from "@/components/dashboard/admin/ProductEditor";
import { getAdminProduct } from "@/lib/data/admin-products";

// FIX (Sep 2026, audit menyeluruh): halaman ini baca data yang berubah-ubah
// (saldo, riwayat, harga tier, dll) lewat Server Component -- tanpa
// force-dynamic, Next.js App Router (v14) bisa nge-cache hasil fetch di
// dalamnya dan nyangkut di data BASI selamanya walau database-nya sudah
// berubah (kejadian nyata: reseller lihat harga lama di /dashboard/generate
// walau tier-nya sudah naik -- lihat riwayat perbaikan di halaman itu).
// Diterapkan ke semua halaman dashboard yang baca data live sebagai
// tindakan pencegahan, bukan cuma yang sudah kebukti kena.
export const dynamic = 'force-dynamic';

export default async function AdminProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getAdminProduct(id);
  if (!product) notFound();

  return (
    <div>
      <PageHeader title={product.name} eyebrow="Edit Produk" back="/dashboard/admin/products" />
      <ProductEditor product={product} />
    </div>
  );
}
