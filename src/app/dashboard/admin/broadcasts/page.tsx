import PageHeader from "@/components/dashboard/PageHeader";
import BroadcastComposer from "@/components/dashboard/admin/BroadcastComposer";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

// FIX (Sep 2026, audit menyeluruh): halaman ini baca data yang berubah-ubah
// (saldo, riwayat, harga tier, dll) lewat Server Component -- tanpa
// force-dynamic, Next.js App Router (v14) bisa nge-cache hasil fetch di
// dalamnya dan nyangkut di data BASI selamanya walau database-nya sudah
// berubah (kejadian nyata: reseller lihat harga lama di /dashboard/generate
// walau tier-nya sudah naik -- lihat riwayat perbaikan di halaman itu).
// Diterapkan ke semua halaman dashboard yang baca data live sebagai
// tindakan pencegahan, bukan cuma yang sudah kebukti kena.
export const dynamic = 'force-dynamic';

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
