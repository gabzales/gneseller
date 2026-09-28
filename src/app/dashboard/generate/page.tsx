import { redirect } from "next/navigation";
import GenerateForm from "@/components/dashboard/generate/GenerateForm";
import { getCurrentUser } from "@/lib/data/user";
import { getProductsWithEffectivePrice } from "@/lib/data/products";

// FIX (Sep 2026): halaman ini gampang kena static/data caching default
// Next.js App Router -- getProductsWithEffectivePrice() manggil RPC
// effective_key_price() yang hasilnya berubah tiap total_topup reseller
// berubah (naik tier), tapi kalau responsnya sempat ke-cache, harga yang
// ketampil di sini bisa nyangkut di hasil PERTAMA kali halaman ini
// pernah dirender -- reseller yang baru saja naik tier tetap lihat harga
// LAMA di preview walau effective_key_price() sendiri sudah benar kalau
// dipanggil ulang (kebukti lewat /api/debug/balance-check yang selalu
// query fresh). force-dynamic mastiin halaman ini + RPC di dalamnya
// SELALU dihitung ulang tiap kali dibuka, gak pernah nyangkut di cache.
export const dynamic = 'force-dynamic';

export default async function GenerateKeysPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Passes effective price (custom/tier/default) per duration for this
  // specific user so the UI shows the right price before generating.
  const products = await getProductsWithEffectivePrice(user.id);

  return <GenerateForm products={products} balance={user.balance} />;
}
