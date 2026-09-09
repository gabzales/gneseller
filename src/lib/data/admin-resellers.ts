import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type AdminResellerRow = {
  id: string;
  name: string;
  email: string;
  balance: number;
  verified: boolean;
  totalTopup: number;
  banned: boolean;
};

export async function getAdminResellers(): Promise<AdminResellerRow[]> {
  const admin = createAdminSupabase();
  if (!admin) return [];

  const { data, error } = await admin
    .from("users")
    .select("id, full_name, email, balance, verified, total_topup, banned")
    .eq("role", "user")
    .order("balance", { ascending: false });

  if (error || !data) return [];

  return data.map((u) => ({
    id: u.id,
    name: u.full_name || u.email,
    email: u.email,
    balance: u.balance,
    verified: u.verified,
    totalTopup: u.total_topup ?? 0,
    banned: u.banned ?? false,
  }));
}
