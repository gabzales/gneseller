import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import BottomNav from "@/components/dashboard/BottomNav";
import { getCurrentUser } from "@/lib/data/user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-dvh bg-ghost-glow bg-no-repeat">
      <Sidebar user={user} />
      <BottomNav user={user} />
      <main className="mx-auto max-w-[1180px] px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:pb-12 lg:pl-[264px] lg:pr-8 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
