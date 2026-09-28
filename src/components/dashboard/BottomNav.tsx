"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_TABS, ADMIN_NAV_ITEM } from "@/lib/nav";
import { ResellerUser } from "@/lib/types";

export default function BottomNav({ user }: { user: ResellerUser }) {
  const pathname = usePathname();
  const tabs = user.role === "admin" ? [...MOBILE_TABS, ADMIN_NAV_ITEM] : MOBILE_TABS;

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
    >
      <div className="flex w-full max-w-[380px] items-center justify-around rounded-full bg-gradient-to-r from-[#262626] to-[#0a0a0a] px-5 py-3 shadow-[0_12px_28px_-10px_rgba(0,0,0,0.45)]">
        {tabs.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 px-4 py-0.5"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-white/25" : ""
                }`}
              >
                <Icon
                  size={19}
                  strokeWidth={active ? 2.3 : 1.9}
                  className={active ? "text-white" : "text-white/60"}
                />
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
