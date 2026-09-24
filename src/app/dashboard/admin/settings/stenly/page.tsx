import PageHeader from "@/components/dashboard/PageHeader";
import StenlySettingsForm from "@/components/dashboard/admin/StenlySettingsForm";

export default function AdminStenlySettingsPage() {
  return (
    <div>
      <PageHeader title="stenly.id" eyebrow="Admin · Pengaturan" back="/dashboard/admin" />
      <StenlySettingsForm />
    </div>
  );
}
