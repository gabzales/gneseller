"use client";

import { useState, useEffect, useRef } from "react";
import { Search, KeyRound, Copy, Check } from "lucide-react";
import { formatDateTime } from "@/lib/format";

type AdminKeyRow = {
  id: string;
  userId: string;
  resellerName: string;
  resellerEmail: string;
  productName: string;
  duration: string;
  price: number;
  keyString: string;
  createdAt: string;
};

export default function AdminKeyHistoryList({ initialKeys }: { initialKeys: AdminKeyRow[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/key-history?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setKeys(data.keys ?? []);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function copy(id: string, value: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-xl2 border border-border bg-surface px-3.5 py-2.5">
        <Search size={15} className="shrink-0 text-ink-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama reseller, email, produk, atau key..."
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
        />
        {loading && <span className="shrink-0 text-[10.5px] text-ink-faint">Mencari...</span>}
      </div>

      {keys.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl2 border border-border bg-surface py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-dim text-primary">
            <KeyRound size={24} />
          </span>
          <p className="text-[13px] text-ink-faint">
            {query ? "Tidak ada hasil yang cocok." : "Belum ada key yang digenerate."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {keys.map((k) => (
            <div key={k.id} className="rounded-xl2 border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold">{k.productName}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-ink-faint">
                    {k.duration} · Rp {k.price.toLocaleString("id-ID")} · {formatDateTime(k.createdAt)}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                    {k.resellerName} ({k.resellerEmail})
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-border-strong bg-surface-2 px-3.5 py-2.5">
                <span className="truncate font-mono text-[12.5px] font-bold tracking-wide text-ink">
                  {k.keyString}
                </span>
                <button
                  onClick={() => copy(k.id, k.keyString)}
                  className="ml-2 flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-primary"
                >
                  {copied === k.id ? (
                    <>
                      <Check size={13} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={13} /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
