"use client";

import { useState } from "react";
import { Send, Megaphone } from "lucide-react";
import { formatDateTime } from "@/lib/format";

type Broadcast = { id: string; title: string; body: string; createdAt: string };

export default function BroadcastComposer({ initialBroadcasts }: { initialBroadcasts: Broadcast[] }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Broadcast[]>(initialBroadcasts);
  const [confirmArmed, setConfirmArmed] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("Judul dan isi pesan wajib diisi.");
      return;
    }
    if (!confirmArmed) {
      setConfirmArmed(true);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal mengirim broadcast.");
      setSent((prev) => [data.broadcast, ...prev]);
      setTitle("");
      setBody("");
      setConfirmArmed(false);
    } catch (err) {
      setError((err as Error).message);
      setConfirmArmed(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="rounded-xl2 border border-border bg-surface p-4">
        <p className="text-[13px] font-bold">Pesan Baru</p>
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setConfirmArmed(false);
            }}
            placeholder="Judul (mis. Maintenance Server)"
            maxLength={120}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary"
          />
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setConfirmArmed(false);
            }}
            placeholder="Isi pesan..."
            maxLength={2000}
            rows={4}
            className="resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary"
          />
        </div>
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60 ${
              confirmArmed ? "bg-danger" : "bg-primary"
            }`}
          >
            <Send size={14} />
            {confirmArmed ? "Yakin kirim ke semua reseller?" : "Kirim Broadcast"}
          </button>
          {confirmArmed && (
            <button
              type="button"
              onClick={() => setConfirmArmed(false)}
              className="text-[11.5px] font-semibold text-ink-faint"
            >
              Batal
            </button>
          )}
        </div>
      </form>

      <h2 className="mb-3 mt-6 font-display text-[14px] font-bold">Riwayat Broadcast</h2>
      {sent.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl2 border border-dashed border-border p-8 text-center">
          <Megaphone size={20} className="text-ink-faint" />
          <p className="text-[12px] text-ink-faint">Belum pernah kirim broadcast.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl2 border border-border bg-surface">
          {sent.map((b) => (
            <div key={b.id} className="px-5 py-4">
              <p className="text-[13px] font-bold">{b.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-dim">{b.body}</p>
              <p className="mt-1.5 text-[10.5px] text-ink-faint">{formatDateTime(b.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
