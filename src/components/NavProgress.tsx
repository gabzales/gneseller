"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Bar tipis di atas layar: langsung muncul begitu link internal diklik
 * (sebelum halaman baru siap), lalu selesai saat route berganti.
 * Tanpa library -- cuma satu listener klik + dua timer.
 */
export default function NavProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickle = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const failSafe = useRef<number | null>(null);

  function clearAll() {
    if (trickle.current) window.clearInterval(trickle.current);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (failSafe.current) window.clearTimeout(failSafe.current);
    trickle.current = hideTimer.current = failSafe.current = null;
  }

  function finish() {
    clearAll();
    setWidth(100);
    hideTimer.current = window.setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 260);
  }

  // Route sudah berganti -> selesai.
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      clearAll();
      setVisible(true);
      setWidth(12);
      trickle.current = window.setInterval(() => {
        setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w));
      }, 180);
      // Pengaman: kalau navigasi gagal/dibatalkan, bar tidak nyangkut.
      failSafe.current = window.setTimeout(finish, 12000);
    }
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearAll();
    };
  }, []);

  return (
    <div className="nav-progress" aria-hidden="true" style={{ opacity: visible ? 1 : 0 }}>
      <div className="nav-progress-bar" style={{ width: `${width}%` }} />
    </div>
  );
}
