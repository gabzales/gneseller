"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";

export default function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-3.5 sm:px-8">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <Image src="/logo-96.png" alt="GHOSTNEWERA" width={32} height={32} className="h-8 w-8 rounded-lg" />
          <span className="font-display text-[14px] font-bold">
            GHOST<span className="text-primary">NEWERA</span>
          </span>
        </Link>
        <div className="flex items-center gap-2.5">
          <Link
            href="/login"
            className="hidden items-center gap-2 rounded-full border border-border-strong px-4 py-2 text-[12.5px] font-semibold text-ink-dim transition-colors hover:text-ink sm:flex"
          >
            Masuk
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-ink-dim sm:hidden"
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-bg px-5 py-3 sm:hidden">
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-center rounded-full border border-border-strong px-4 py-2.5 text-[12.5px] font-semibold text-ink-dim"
          >
            Masuk
          </Link>
          <a
            href="#jadi-reseller"
            onClick={() => setOpen(false)}
            className="mt-2.5 flex w-full items-center justify-center rounded-full bg-ink px-4 py-2.5 text-[12.5px] font-semibold text-bg"
          >
            Cara Jadi Reseller
          </a>
        </div>
      )}
    </nav>
  );
}
