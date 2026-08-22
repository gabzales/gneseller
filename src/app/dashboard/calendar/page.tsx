import { redirect } from "next/navigation";
import CalendarView from "@/components/dashboard/calendar/CalendarView";
import { getCurrentUser } from "@/lib/data/user";
import { getActivityDays, getKeyHistory, getTopupHistory } from "@/lib/data/activity";

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
