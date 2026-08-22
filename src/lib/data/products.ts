import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { PRODUCTS } from "@/lib/mock-data";
import { Product } from "@/lib/types";

export async function getProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured) return PRODUCTS;

  const supabase = await createServerSupabase();
  if (!supabase) return PRODUCTS;

  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, product_durations ( id, label, days, price )")
    .eq("active", true)
    .order("sort_order");

  if (error || !data) return PRODUCTS;

  return data.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    durations: (p.product_durations ?? [])
      .slice()
      .sort((a: { days: number }, b: { days: number }) => a.days - b.days),
  }));
}

/**
 * Same as getProducts(), but overrides each duration's `price` with the
 * result of effective_key_price() for the given user so that the Generate
 * page shows the user's actual price (custom or tier) instead of the
 * default product price.
 *
 * Uses the admin client (service role) because effective_key_price() needs
 * to read from custom_prices and price_tiers which have no authenticated
 * RLS policy -- the only caller is a server component that already
 * confirmed the user is logged in.
 */
export async function getProductsWithEffectivePrice(userId: string): Promise<Product[]> {
  if (!isSupabaseConfigured) return PRODUCTS;

  const admin = createAdminSupabase();
  if (!admin) return getProducts();

  // Fetch all active products + durations
  const { data: products, error: pErr } = await admin
    .from("products")
    .select("id, name, category, product_durations ( id, label, days, price )")
    .eq("active", true)
    .order("sort_order");

  if (pErr || !products) return getProducts();

  // Resolve effective price per duration in parallel
  const result = await Promise.all(
    products.map(async (p) => {
      const durations = await Promise.all(
        ((p.product_durations ?? []) as { id: string; label: string; days: number; price: number }[])
          .slice()
          .sort((a, b) => a.days - b.days)
          .map(async (d) => {
            const { data } = await admin.rpc("effective_key_price", {
              p_user_id: userId,
              p_product_id: p.id,
              p_duration_id: d.id,
              p_default_price: d.price,
            });
            return { ...d, price: typeof data === "number" ? data : d.price };
          })
      );
      return { id: p.id, name: p.name, category: p.category, durations };
    })
  );

  return result;
}
