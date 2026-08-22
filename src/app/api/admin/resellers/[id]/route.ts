import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";

/**
 * PATCH { banned: boolean } — soft ban/unban. Blocks the reseller from
 * generating keys, topping up (settle_topup), or having balance settled
 * via webhook (see assert_not_banned() in 0006_reseller_ops.sql), without
 * touching their existing history/balance. Reversible.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id: targetUserId } = await params;
  if (targetUserId === admin_user.id) {
    return NextResponse.json(
      { error: "cannot_ban_self", message: "Tidak bisa mem-banned akun sendiri." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.banned !== "boolean") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { data, error } = await admin
    .from("users")
    .update({ banned: body.banned, banned_at: body.banned ? new Date().toISOString() : null })
    .eq("id", targetUserId)
    .eq("role", "user") // never allow banning another admin through this endpoint
    .select("id, banned")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "update_failed", message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found", message: "Reseller tidak ditemukan." }, { status: 404 });

  return NextResponse.json({ ok: true, banned: data.banned });
}

/**
 * DELETE — permanent. Cascades to reseller_keys, topups,
 * balance_adjustments, custom_prices (all ON DELETE CASCADE from
 * public.users since 0001/0004/0005), plus the auth.users row itself so
 * the reseller can't just log back in with the same credentials.
 *
 * No "are you sure" here server-side by design (the confirm step lives
 * in the UI) -- but this is deliberately a hard, irreversible delete, not
 * a soft one, so the client MUST double-confirm before calling this.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id: targetUserId } = await params;
  if (targetUserId === admin_user.id) {
    return NextResponse.json(
      { error: "cannot_delete_self", message: "Tidak bisa menghapus akun sendiri." },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  // Confirm it's actually a reseller (role='user') before touching auth.
  const { data: target } = await admin.from("users").select("id, role").eq("id", targetUserId).maybeSingle();
  if (!target) return NextResponse.json({ error: "not_found", message: "Reseller tidak ditemukan." }, { status: 404 });
  if (target.role !== "user") {
    return NextResponse.json(
      { error: "cannot_delete_admin", message: "Tidak bisa menghapus akun admin lewat sini." },
      { status: 400 }
    );
  }

  // Deleting the auth.users row cascades to public.users (0001: `id uuid
  // primary key references auth.users (id) on delete cascade`), which in
  // turn cascades to everything referencing public.users.
  const { error } = await admin.auth.admin.deleteUser(targetUserId);
  if (error) return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
