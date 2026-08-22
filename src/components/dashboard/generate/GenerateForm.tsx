"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, KeyRound, Check, Loader2, AlertCircle } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import { formatIDR } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Product } from "@/lib/types";

export default function GenerateForm({
  products,
  balance,
}: {
  products: Product[];
  balance: number;
}) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [durationId, setDurationId] = useState("");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resultKey, setResultKey] = useState("");

  const product = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId]
  );
  const duration = useMemo(
    () => product?.durations.find((d) => d.id === durationId),
    [product, durationId]
  );

  const canGenerate = Boolean(product && duration && balance >= (duration?.price ?? 0));

  async function handleGenerate() {
    if (!canGenerate || !product || !duration) return;
    setStatus("loading");
    setErrorMsg("");

    if (!isSupabaseConfigured) {
      // Demo mode — no backend yet, simulate so the flow stays reviewable.
      setTimeout(() => {
        setResultKey(
          Array.from({ length: 4 })
            .map(() => Math.random().toString(36).slice(2, 6).toUpperCase())
            .join("-")
        );
        setStatus("done");
      }, 800);
      return;
    }

    try {
      const res = await fetch("/api/generate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, durationId: duration.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal membuat key.");
      setResultKey(data.key.key_string);
      setStatus("done");
      router.refresh(); // re-fetch balance in the layout/sidebar
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal membuat key.");
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-[560px]">
      <PageHeader title="Generate Keys" />

      {status === "done" ? (
        <div className="animate-fadeUp rounded-xl2 border border-primary-dim bg-surface p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-dim text-primary">
            <Check size={26} />
          </span>
          <p className="mt-4 font-display text-[16px] font-bold">Key berhasil dibuat</p>
          <p className="mt-1 text-[12.5px] text-ink-faint">
            {product?.name} · {duration?.label}
          </p>
          <div className="mt-4 rounded-xl border border-border-strong bg-surface-2 px-4 py-3 font-mono text-[15px] font-bold tracking-wide text-primary">
            {resultKey}
          </div>
          <button
            onClick={() => {
              setStatus("idle");
              setProductId("");
              setDurationId("");
            }}
            className="mt-5 w-full rounded-xl bg-primary py-3 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Buat Key Lain
          </button>
        </div>
      ) : (
        <>
          <div>
            <label className="text-[12.5px] font-semibold text-ink-dim">
              Select Product
            </label>
            <div className="relative mt-2">
              <button
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-xl border border-border-strong bg-surface px-4 py-3.5 text-left text-[13.5px] transition-colors hover:border-primary/50"
              >
                <span className={product ? "text-ink" : "text-ink-faint"}>
                  {product ? product.name : "Choose a product..."}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>
              {open && (
                <div className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-border-strong bg-surface-2 py-1.5 shadow-glow">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setProductId(p.id);
                        setDurationId("");
                        setOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] text-ink-dim transition-colors hover:bg-surface hover:text-ink"
                    >
                      {p.name}
                      <span className="text-[10.5px] text-ink-faint">{p.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <label className="text-[12.5px] font-semibold text-ink-dim">
              Key Duration
            </label>
            <div className="mt-2 flex flex-wrap gap-2.5">
              {product ? (
                product.durations.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDurationId(d.id)}
                    className={`rounded-full border px-4 py-2.5 text-[12.5px] font-semibold transition-colors ${
                      durationId === d.id
                        ? "border-primary bg-primary-dim text-primary"
                        : "border-border-strong text-ink-dim hover:border-primary/40 hover:text-ink"
                    }`}
                  >
                    {d.label} · {formatIDR(d.price)}
                  </button>
                ))
              ) : (
                <p className="text-[12.5px] text-ink-faint">
                  Pilih produk dulu untuk melihat pilihan durasi.
                </p>
              )}
            </div>
          </div>

          {duration && (
            <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-[13px]">
              <span className="text-ink-dim">Total harga</span>
              <span className="font-display font-bold text-ink">
                {formatIDR(duration.price)}
              </span>
            </div>
          )}

          {product && duration && balance < duration.price && (
            <p className="mt-3 text-[12px] font-medium text-danger">
              Saldo tidak mencukupi. Silakan top up terlebih dahulu.
            </p>
          )}

          {status === "error" && (
            <p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-danger">
              <AlertCircle size={13} /> {errorMsg}
            </p>
          )}

          <button
            disabled={!canGenerate || status === "loading"}
            onClick={handleGenerate}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "loading" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <KeyRound size={16} />
            )}
            {status === "loading" ? "Memproses..." : "Generate Key"}
          </button>
        </>
      )}
    </div>
  );
}
