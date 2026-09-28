import PageHeader from "@/components/dashboard/PageHeader";
import PartnerApiSettingsForm from "@/components/dashboard/admin/PartnerApiSettingsForm";

export default function AdminPartnerApiSettingsPage() {
  return (
    <div>
      <PageHeader title="Partner API" eyebrow="Admin · Pengaturan" back="/dashboard/admin" />
      <a
        href="/docs/api-v1"
        target="_blank"
        rel="noreferrer"
        className="mb-4 flex items-center justify-between rounded-xl2 border border-border bg-surface px-4 py-3 text-[13px] font-semibold hover:bg-surface-2"
      >
        <span>Dokumentasi API untuk toko client</span>
        <span className="font-mono text-[11.5px] text-ink-faint">/docs/api-v1 ↗</span>
      </a>
      <PartnerApiSettingsForm />
    </div>
  );
}
