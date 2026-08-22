"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Megaphone } from "lucide-react";
import { formatDateTime } from "@/lib/format";

type BroadcastItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

/**
 * Replaces the dummy bell button that used to live inline in PageHeader.
 * Fetches broadcasts (see /api/broadcasts) on mount, shows an unread-dot
 * badge, and marks everything read the moment the dropdown opens so the
 * badge clears without requiring the reseller to open each item.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BroadcastItem[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/broadcasts");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.broadcasts ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silent -- notification bell degrading to "no items" is fine, not
      // worth surfacing an error state for a non-critical feature
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      setUnreadCount(0);
      setItems((prev) => (prev ? prev.map((i) => ({ ...i, read: true })) : prev));
      fetch("/api/broadcasts/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch(() => {});
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-ink-dim transition-colors hover:text-ink"
        aria-label="Notifikasi"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-[320px] max-w-[85vw] rounded-xl2 border border-border bg-surface shadow-glow">
          <div className="border-b border-border px-4 py-3">
            <p className="text-[13px] font-bold">Notifikasi</p>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {items === null ? (
              <p className="px-4 py-6 text-center text-[12px] text-ink-faint">Memuat...</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <Megaphone size={20} className="text-ink-faint" />
                <p className="text-[12px] text-ink-faint">Belum ada pengumuman.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12.5px] font-bold">{item.title}</p>
                      {!item.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose" />}
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-dim">{item.body}</p>
                    <p className="mt-1.5 text-[10.5px] text-ink-faint">{formatDateTime(item.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
