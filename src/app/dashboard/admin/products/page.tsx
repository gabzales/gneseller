import PageHeader from "@/components/dashboard/PageHeader";
import NewProductForm from "@/components/dashboard/admin/NewProductForm";
import ProductRow from "@/components/dashboard/admin/ProductRow";
import { getAdminProducts } from "@/lib/data/admin-products";

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
