"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, ADMIN_NAV_ITEM } from "@/lib/nav";
import Avatar from "@/components/Avatar";
import LogoutButton from "@/components/LogoutButton";
import { ResellerUser } from "@/lib/types";

export default function Sidebar({ user }: { user: ResellerUser }) {
  const pathname = usePathname();
  const items = user.role === "admin" ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-[264px] flex-col border-r border-border bg-surface/60">
      <Link
        href="/"
        className="flex items-center gap-2.5 px-6 h-[72px] shrink-0 border-b border-border"
      >
        <Image src="/logo-96.png" alt="GHOSTNEWERA" width={36} height={36} className="h-9 w-9 rounded-xl" />
        <span className="font-display font-bold text-[15px] tracking-tight">
          GHOST<span className="text-primary">NEWERA</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-5 flex flex-col gap-1">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium transition-colors ${
                active
                  ? "bg-primary-dim text-primary"
                  : "text-ink-dim hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon size={18} strokeWidth={2} />
              {item.label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-xl px-2.5 py-2.5">
          <Avatar seed={user.avatarSeed} name={user.name} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{user.name}</p>
            <p className="truncate text-[11px] text-ink-faint">{user.email}</p>
          </div>
        </div>
        <LogoutButton className="mt-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-rose transition-colors hover:bg-rose-dim" />
      </div>
    </aside>
  );
}
