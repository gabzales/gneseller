import { notFound } from "next/navigation";
import PageHeader from "@/components/dashboard/PageHeader";
import ProductEditor from "@/components/dashboard/admin/ProductEditor";
import { getAdminProduct } from "@/lib/data/admin-products";

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
