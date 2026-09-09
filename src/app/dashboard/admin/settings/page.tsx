import PageHeader from "@/components/dashboard/PageHeader";
import ProviderSettingsForm from "@/components/dashboard/admin/ProviderSettingsForm";

export default function AdminSettingsPage() {
  return (
    <div>
      <PageHeader title="Reseller API" eyebrow="Admin · Pengaturan" back="/dashboard/admin" />
      <ProviderSettingsForm />
    </div>
  );
}
