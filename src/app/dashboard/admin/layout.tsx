import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/require-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) redirect("/dashboard");

  return <div className="mx-auto max-w-[900px]">{children}</div>;
}
