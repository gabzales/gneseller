import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { KEY_HISTORY, TOPUP_HISTORY, ACTIVITY_DAYS } from "@/lib/mock-data";
import { GeneratedKey, TopupTx } from "@/lib/types";

export async function getKeyHistory(): Promise<GeneratedKey[]> {
  if (!isSupabaseConfigured) return KEY_HISTORY;
  const supabase = await createServerSupabase();
  if (!supabase) return KEY_HISTORY;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("reseller_keys")
    .select("id, product_name, duration_label, key_string, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((k) => ({
    id: k.id,
    productName: k.product_name,
    duration: k.duration_label,
    keyString: k.key_string,
    createdAt: k.created_at,
  }));
}

export async function getTopupHistory(): Promise<TopupTx[]> {
  if (!isSupabaseConfigured) return TOPUP_HISTORY;
  const supabase = await createServerSupabase();
  if (!supabase) return TOPUP_HISTORY;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("topups")
    .select("id, nominal, bonus, total, method, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((t) => ({
    id: t.id,
    nominal: t.nominal,
    bonus: t.bonus,
    total: t.total,
    method: t.method,
    status: t.status,
    createdAt: t.created_at,
  }));
}

export async function getActivityDays(): Promise<number[]> {
  if (!isSupabaseConfigured) return ACTIVITY_DAYS;
  const [keys, topups] = await Promise.all([getKeyHistory(), getTopupHistory()]);
  const days = new Set<number>();
  [...keys.map((k) => k.createdAt), ...topups.map((t) => t.createdAt)].forEach((iso) => {
    days.add(new Date(iso).getDate());
  });
  return Array.from(days);
}
