import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.nominal !== undefined) {
    const nominal = Math.trunc(Number(body.nominal));
    if (!Number.isFinite(nominal) || nominal <= 0) {
      return NextResponse.json({ error: "invalid_nominal", message: "Nominal harus lebih dari 0." }, { status: 400 });
    }
    patch.nominal = nominal;
  }
  if (body.bonus !== undefined) {
    const bonus = Math.trunc(Number(body.bonus));
    if (!Number.isFinite(bonus) || bonus < 0) {
      return NextResponse.json({ error: "invalid_bonus", message: "Bonus tidak boleh negatif." }, { status: 400 });
    }
    patch.bonus = bonus;
  }
  if (typeof body.active === "boolean") patch.active = body.active;
  if (Number.isFinite(Number(body.sortOrder))) patch.sort_order = Math.trunc(Number(body.sortOrder));

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { data, error } = await admin
    .from("topup_packages")
    .update(patch)
    .eq("id", id)
    .select("id, nominal, bonus, active, sort_order")
    .maybeSingle();

  if (error) {
    const message = error.message.includes("duplicate key")
      ? "Paket dengan nominal ini sudah ada."
      : error.message;
    return NextResponse.json({ error: "update_failed", message }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    package: { id: data.id, nominal: data.nominal, bonus: data.bonus, active: data.active, sortOrder: data.sort_order },
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { error } = await admin.from("topup_packages").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
