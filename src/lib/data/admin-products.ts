import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { AdminProduct } from "@/lib/types";

/**
 * Admin view of the catalog -- unlike getProducts() in src/lib/data/products.ts
 * this includes inactive products and the internal stock_mode /
 * provider_item_id / manual stock count fields, so it always goes through
 * the service-role client (never the anon/RLS-bound one) and must only be
 * called from a page/route already gated by getAdminUser().
 */
export async function getAdminProducts(): Promise<AdminProduct[]> {
  const admin = createAdminSupabase();
  if (!admin) return [];

  const { data: products, error } = await admin
    .from("products")
    .select("id, name, category, active, sort_order, product_durations ( id, label, days, price, stock_mode, provider_item_id )")
    .order("sort_order");

  if (error || !products) return [];

  const { data: stockRows } = await admin
    .from("key_stock")
    .select("product_id, duration_id")
    .eq("used", false);

  const stockCounts = new Map<string, number>();
  for (const row of stockRows ?? []) {
    const key = `${row.product_id}:${row.duration_id}`;
    stockCounts.set(key, (stockCounts.get(key) ?? 0) + 1);
  }

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    active: p.active,
    sortOrder: p.sort_order,
    durations: (p.product_durations ?? [])
      .slice()
      .sort((a: { days: number }, b: { days: number }) => a.days - b.days)
      .map((d: { id: string; label: string; days: number; price: number; stock_mode: "manual" | "auto"; provider_item_id: string | null }) => ({
        id: d.id,
        label: d.label,
        days: d.days,
        price: d.price,
        stockMode: d.stock_mode,
        providerItemId: d.provider_item_id,
        manualStock: stockCounts.get(`${p.id}:${d.id}`) ?? 0,
      })),
  }));
}

export async function getAdminProduct(id: string): Promise<AdminProduct | null> {
  const products = await getAdminProducts();
  return products.find((p) => p.id === id) ?? null;
}
