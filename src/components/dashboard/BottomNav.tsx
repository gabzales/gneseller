"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { MOBILE_TABS, ADMIN_NAV_ITEM } from "@/lib/nav";
import { ResellerUser } from "@/lib/types";

export default function BottomNav({ user }: { user: ResellerUser }) {
  const pathname = usePathname();
  // Highlight pindah SEKETIKA saat diklik (optimistic), tidak nunggu halaman siap.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);
  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => setPending(null), 10000);
    return () => window.clearTimeout(t);
  }, [pending]);
  const shown = pending ?? pathname;
  const onNavClick = (e: React.MouseEvent, href: string) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (href !== pathname) setPending(href);
  };
  const tabs = user.role === "admin" ? [...MOBILE_TABS, ADMIN_NAV_ITEM] : MOBILE_TABS;

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
    >
      <div className="flex w-full max-w-[380px] items-center justify-around rounded-full bg-gradient-to-r from-[#262626] to-[#0a0a0a] px-5 py-3 shadow-[0_12px_28px_-10px_rgba(0,0,0,0.45)]">
        {tabs.map((item) => {
          const active = item.exact
            ? shown === item.href
            : shown.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => onNavClick(e, item.href)}
              className="tap flex flex-col items-center gap-0.5 px-4 py-0.5"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-white/25" : ""
                }`}
              >
                {pending === item.href ? (
                  <Loader2 size={19} className="animate-spin text-white" />
                ) : (
                  <Icon
                    size={19}
                    strokeWidth={active ? 2.3 : 1.9}
                    className={active ? "text-white" : "text-white/60"}
                  />
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
