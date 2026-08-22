import PageHeader from "@/components/dashboard/PageHeader";
import GenspaySettingsForm from "@/components/dashboard/admin/GenspaySettingsForm";

export default function AdminGenspaySettingsPage() {
  return (
    <div>
      <PageHeader title="GensPay" eyebrow="Admin · Pengaturan" back="/dashboard/admin" />
      <GenspaySettingsForm />
    </div>
  );
}
