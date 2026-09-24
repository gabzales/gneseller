import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import BottomNav from "@/components/dashboard/BottomNav";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getCurrentUser } from "@/lib/data/user";
import type { ThemeId } from "@/lib/theme";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    // Nested ThemeProvider, seeded from this account's saved theme
    // (public.users.theme) -- takes over from the root layout's
    // localStorage-only ThemeProvider for everything under /dashboard,
    // so palette choice follows the ACCOUNT rather than just this
    // device. See ThemeProvider.tsx for how initialTheme reconciles
    // with the pre-paint script's localStorage guess.
    <ThemeProvider initialTheme={user.theme as ThemeId}>
      <div className="min-h-dvh bg-ghost-glow bg-no-repeat">
        <Sidebar user={user} />
        <BottomNav user={user} />
        <main className="mx-auto max-w-[1180px] px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:pb-12 lg:pl-[264px] lg:pr-8 lg:pt-8">
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
