import PageHeader from "@/components/dashboard/PageHeader";
import PartnerApiSettingsForm from "@/components/dashboard/admin/PartnerApiSettingsForm";

export default function AdminPartnerApiSettingsPage() {
  return (
    <div>
      <PageHeader title="Partner API" eyebrow="Admin · Pengaturan" back="/dashboard/admin" />
      <PartnerApiSettingsForm />
    </div>
  );
}
