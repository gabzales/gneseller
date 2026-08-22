import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";

export type TopupPackageRow = {
  id: string;
  nominal: number;
  bonus: number;
  active: boolean;
  sortOrder: number;
};

// GET is used both by the admin management page and (indirectly) mirrors
// what /api/topup/create reads from -- keep the shape stable.
export async function GET() {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { data, error } = await admin
    .from("topup_packages")
    .select("id, nominal, bonus, active, sort_order")
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: "fetch_failed", message: error.message }, { status: 500 });

  return NextResponse.json({
    packages: (data ?? []).map((p) => ({
      id: p.id,
      nominal: p.nominal,
      bonus: p.bonus,
      active: p.active,
      sortOrder: p.sort_order,
    })),
  });
}

export async function POST(request: Request) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const nominal = Math.trunc(Number(body?.nominal));
  const bonus = Math.trunc(Number(body?.bonus ?? 0));
  const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0;

  if (!Number.isFinite(nominal) || nominal <= 0) {
    return NextResponse.json({ error: "invalid_nominal", message: "Nominal harus lebih dari 0." }, { status: 400 });
  }
  if (!Number.isFinite(bonus) || bonus < 0) {
    return NextResponse.json({ error: "invalid_bonus", message: "Bonus tidak boleh negatif." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { data, error } = await admin
    .from("topup_packages")
    .insert({ nominal, bonus, sort_order: sortOrder })
    .select("id, nominal, bonus, active, sort_order")
    .single();

  if (error) {
    const message = error.message.includes("duplicate key")
      ? "Paket dengan nominal ini sudah ada."
      : error.message;
    return NextResponse.json({ error: "create_failed", message }, { status: 400 });
  }

  return NextResponse.json({
    package: { id: data.id, nominal: data.nominal, bonus: data.bonus, active: data.active, sortOrder: data.sort_order },
  });
}
