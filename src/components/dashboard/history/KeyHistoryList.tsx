"use client";

import { useState } from "react";
import { KeyRound, Copy, Check } from "lucide-react";
import { GeneratedKey } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

export default function KeyHistoryList({ keys }: { keys: GeneratedKey[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(id: string, value: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl2 border border-border bg-surface py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-dim text-primary">
          <KeyRound size={24} />
        </span>
        <p className="text-[13px] text-ink-faint">Belum ada key</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {keys.map((k) => (
        <div key={k.id} className="rounded-xl2 border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-bold">{k.productName}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-faint">
                {k.duration} · {formatDateTime(k.createdAt)}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary-dim px-2.5 py-1 text-[10.5px] font-semibold text-primary">
              {k.duration}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border-strong bg-surface-2 px-3.5 py-2.5">
            <span className="font-mono text-[13px] font-bold tracking-wide text-ink">
              {k.keyString}
            </span>
            <button
              onClick={() => copy(k.id, k.keyString)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-primary"
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
  );
}
