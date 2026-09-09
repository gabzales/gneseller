import PageHeader from "@/components/dashboard/PageHeader";
import BroadcastComposer from "@/components/dashboard/admin/BroadcastComposer";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export default async function AdminBroadcastsPage() {
  const admin_user = await getAdminUser();
  if (!admin_user) redirect("/dashboard");

  const admin = createAdminSupabase();
  const { data } = admin
    ? await admin.from("broadcasts").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(50)
    : { data: null };

  const broadcasts = (data ?? []).map((b) => ({ id: b.id, title: b.title, body: b.body, createdAt: b.created_at }));

  return (
    <div>
      <PageHeader title="Broadcast Notifikasi" eyebrow="Admin" back="/dashboard/admin" />
      <p className="mb-3 text-[12px] text-ink-faint">
        Kirim pengumuman ke semua reseller sekaligus — langsung muncul di ikon lonceng mereka. Tidak bisa
        ditarik/diedit lagi setelah terkirim, jadi cek dulu sebelum kirim.
      </p>
      <BroadcastComposer initialBroadcasts={broadcasts} />
    </div>
  );
}
