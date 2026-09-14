import { redirect } from "next/navigation";
import CalendarView from "@/components/dashboard/calendar/CalendarView";
import { getCurrentUser } from "@/lib/data/user";
import { getActivityDays, getKeyHistory, getTopupHistory } from "@/lib/data/activity";

// FIX (Sep 2026, audit menyeluruh): halaman ini baca data yang berubah-ubah
// (saldo, riwayat, harga tier, dll) lewat Server Component -- tanpa
// force-dynamic, Next.js App Router (v14) bisa nge-cache hasil fetch di
// dalamnya dan nyangkut di data BASI selamanya walau database-nya sudah
// berubah (kejadian nyata: reseller lihat harga lama di /dashboard/generate
// walau tier-nya sudah naik -- lihat riwayat perbaikan di halaman itu).
// Diterapkan ke semua halaman dashboard yang baca data live sebagai
// tindakan pencegahan, bukan cuma yang sudah kebukti kena.
export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [activityDays, keyHistory, topupHistory] = await Promise.all([
    getActivityDays(),
    getKeyHistory(),
    getTopupHistory(),
  ]);

  return (
    <CalendarView
      activityDays={activityDays}
      keyHistory={keyHistory}
      topupHistory={topupHistory}
    />
  );
}
