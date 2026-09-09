import PageHeader from "@/components/dashboard/PageHeader";
import KeyHistoryList from "@/components/dashboard/history/KeyHistoryList";
import { getKeyHistory } from "@/lib/data/activity";

export default async function KeyHistoryPage() {
  const keys = await getKeyHistory();

  return (
    <div className="mx-auto max-w-[640px]">
      <PageHeader title="Riwayat Key" />
      <KeyHistoryList keys={keys} />
    </div>
  );
}
