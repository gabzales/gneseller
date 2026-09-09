import PageHeader from "@/components/dashboard/PageHeader";
import AdminKeyHistoryList from "@/components/dashboard/admin/AdminKeyHistoryList";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export default async function AdminKeyHistoryPage() {
  const admin_user = await getAdminUser();
  if (!admin_user) redirect("/dashboard");

  const admin = createAdminSupabase();
  const { data } = admin
    ? await admin
        .from("admin_key_history")
        .select("id, user_id, full_name, email, product_name, duration_label, price, key_string, created_at")
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: null };

  const keys = (data ?? []).map((k) => ({
    id: k.id,
    userId: k.user_id,
    resellerName: k.full_name || k.email,
    resellerEmail: k.email,
    productName: k.product_name,
    duration: k.duration_label,
    price: k.price,
    keyString: k.key_string,
    createdAt: k.created_at,
  }));

  return (
    <div>
      <PageHeader title="Riwayat Key (Semua Reseller)" eyebrow="Admin" back="/dashboard/admin" />
      <p className="mb-3 text-[12px] text-ink-faint">
        Semua key yang pernah digenerate lintas reseller, terbaru dulu. Cari nama/email reseller, nama
        produk, atau key-nya langsung.
      </p>
      <AdminKeyHistoryList initialKeys={keys} />
    </div>
  );
}
