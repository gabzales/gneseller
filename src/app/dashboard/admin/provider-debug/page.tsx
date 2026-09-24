import Link from "next/link";
import { AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import { getProviderHealthReport } from "@/lib/provider/mapping-health";

// Sama seperti halaman admin lain yang baca data live -- lihat catatan
// panjang soal ini di src/app/dashboard/admin/page.tsx.
export const dynamic = "force-dynamic";

function formatRupiah(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

function StatusRow({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl2 border p-4 ${
        ok ? "border-emerald-500/25 bg-emerald-500/5" : "border-red-500/25 bg-red-500/5"
      }`}
    >
      {ok ? (
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" />
      ) : (
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-400" />
      )}
      <div className="min-w-0">
        <p className="text-[13.5px] font-bold">{title}</p>
        <p className="text-[12px] text-ink-faint">{detail}</p>
      </div>
    </div>
  );
}

export default async function ProviderDebugPage() {
  const report = await getProviderHealthReport({ fresh: true });

  const brokenMappings = report.mapping.filter((m) => !m.foundInProviderCatalogRightNow);
  const balanceLow = report.balance.ok && report.balance.amount <= 0;

  return (
    <div>
      <PageHeader title="Debug Provider" eyebrow="Admin · vipibmstore.com" back="/dashboard/admin" />
      <p className="mb-4 text-[12.5px] text-ink-faint">
        Diagnosa kenapa generate key mode Auto gagal (&quot;Invalid request&quot;, &quot;Insufficient balance&quot;, dll) —
        semua dicek LIVE ke vipibmstore.com tiap halaman ini dibuka.
      </p>

      <div className="space-y-3">
        <StatusRow
          ok={report.balance.ok && !balanceLow}
          title={report.balance.ok ? `Saldo di vipibmstore.com: ${formatRupiah(report.balance.amount)}` : "Gagal cek saldo vipibmstore.com"}
          detail={
            report.balance.ok
              ? balanceLow
                ? "Saldo habis/nol — ini penyebab paling mungkin dari error 'Insufficient balance' saat generate key. Perlu top up langsung di dashboard vipibmstore.com."
                : "Saldo tersedia untuk order ke provider."
              : report.balance.message
          }
        />
        <StatusRow
          ok={report.catalog.ok}
          title={report.catalog.ok ? `Katalog provider terjangkau (${report.catalog.size} item)` : "Gagal narik katalog vipibmstore.com"}
          detail={
            report.catalog.ok
              ? "Koneksi & API Key ke vipibmstore.com berfungsi normal."
              : `${report.catalog.message} — API Key/Secret Reseller API di Pengaturan mungkin salah/expired.`
          }
        />
        <StatusRow
          ok={brokenMappings.length === 0}
          title={
            brokenMappings.length === 0
              ? "Semua mapping produk Auto sehat"
              : `${brokenMappings.length} durasi mapping-nya rusak`
          }
          detail={
            brokenMappings.length === 0
              ? "Semua provider_item_id yang tersimpan cocok dengan katalog vipibmstore.com saat ini."
              : "Lihat daftar di bawah — durasi ini akan selalu gagal generate sampai mapping-nya diperbaiki di halaman Edit Produk."
          }
        />
      </div>

      {brokenMappings.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[13px] font-bold">Mapping rusak</p>
          <div className="divide-y divide-border rounded-xl2 border border-border bg-surface">
            {brokenMappings.map((m, i) => (
              <div key={i} className="px-4 py-3">
                <p className="text-[13px] font-semibold">
                  {m.product} — {m.duration}
                </p>
                <p className="text-[11.5px] text-ink-faint">
                  provider_item_id tersimpan: <span className="font-mono">{m.provider_item_id}</span>
                </p>
                <p className="mt-0.5 text-[11.5px] text-red-400">{m.verdict}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-[13px] font-bold">Riwayat gagal generate (20 terakhir)</p>
        {report.recentErrors.length === 0 ? (
          <div className="rounded-xl2 border border-border bg-surface px-4 py-6 text-center text-[12.5px] text-ink-faint">
            Belum ada kegagalan tercatat.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl2 border border-border bg-surface">
            {report.recentErrors.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12.5px] font-semibold text-red-400">{e.errorMessage}</p>
                  <p className="whitespace-nowrap text-[11px] text-ink-faint">
                    {new Date(e.createdAt).toLocaleString("id-ID")}
                  </p>
                </div>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  product_id: <span className="font-mono">{e.productId}</span> · duration_id:{" "}
                  <span className="font-mono">{e.durationId}</span> · provider_item_id:{" "}
                  <span className="font-mono">{e.providerItemId || "-"}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Link
        href="/dashboard/admin"
        className="mt-6 flex items-center gap-2 text-[12.5px] font-semibold text-ink-faint hover:text-ink"
      >
        <ArrowLeft size={14} /> Kembali ke Admin
      </Link>
    </div>
  );
}
