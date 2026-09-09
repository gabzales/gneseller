import { redirect } from "next/navigation";
import { IdCard, Mail, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import Avatar from "@/components/Avatar";
import LogoutButton from "@/components/LogoutButton";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { getCurrentUser } from "@/lib/data/user";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-[520px]">
      <PageHeader title="Profil" />

      <div className="rounded-xl2 border border-border bg-surface p-8 text-center">
        <Avatar seed={user.avatarSeed} name={user.name} size={84} />
        <p className="mx-auto mt-4 font-display text-[17px] font-bold">
          {user.name}
        </p>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-dim px-3 py-1 text-[11px] font-semibold text-primary">
          <ShieldCheck size={13} /> {user.role}
        </span>
      </div>

      <div className="mt-4 divide-y divide-border rounded-xl2 border border-border bg-surface">
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-dim text-primary">
            <IdCard size={16} />
          </span>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
              ID Pengguna
            </p>
            <p className="text-[13.5px] font-semibold">{user.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-dim text-primary">
            <Mail size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
              Email
            </p>
            <p className="truncate text-[13.5px] font-semibold">{user.email}</p>
          </div>
        </div>
      </div>

      <ThemeSwitcher />

      <LogoutButton className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl2 border border-rose-dim bg-rose-dim px-5 py-4 text-[13.5px] font-bold text-rose transition-opacity hover:opacity-90" />
    </div>
  );
}
