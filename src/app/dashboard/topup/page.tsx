import { redirect } from "next/navigation";
import TopupForm from "@/components/dashboard/topup/TopupForm";
import { getCurrentUser } from "@/lib/data/user";
import { getTopupPackages } from "@/lib/data/topup-packages";

export default async function TopupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const packages = await getTopupPackages();

  return <TopupForm balance={user.balance} verified={user.verified} packages={packages} />;
}
