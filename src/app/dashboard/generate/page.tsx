import { redirect } from "next/navigation";
import GenerateForm from "@/components/dashboard/generate/GenerateForm";
import { getCurrentUser } from "@/lib/data/user";
import { getProductsWithEffectivePrice } from "@/lib/data/products";

export default async function GenerateKeysPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Passes effective price (custom/tier/default) per duration for this
  // specific user so the UI shows the right price before generating.
  const products = await getProductsWithEffectivePrice(user.id);

  return <GenerateForm products={products} balance={user.balance} />;
}
