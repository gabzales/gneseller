"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NotificationBell from "@/components/dashboard/NotificationBell";

export default function PageHeader({
  title,
  eyebrow,
  back = "/dashboard",
  action,
}: {
  title: string;
  eyebrow?: string;
  back?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-5 border-b border-border bg-bg/85 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:pt-1 lg:backdrop-blur-none">
      <div className="flex items-center gap-3">
        {back && (
          <Link
            href={back}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-ink-dim transition-colors hover:text-ink lg:hidden"
            aria-label="Kembali"
          >
            <ArrowLeft size={17} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate font-display text-[19px] font-bold leading-tight lg:text-[26px]">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
