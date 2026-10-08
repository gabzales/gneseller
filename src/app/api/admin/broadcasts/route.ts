import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { data, error } = await admin
    .from("broadcasts")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: "fetch_failed", message: error.message }, { status: 500 });

  return NextResponse.json({
    broadcasts: (data ?? []).map((b) => ({ id: b.id, title: b.title, body: b.body, createdAt: b.created_at })),
  });
}

export async function POST(request: Request) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  // Broadcasts hit every reseller's dashboard at once -- rate-limited
  // per admin to keep a scripted/accidental loop from spamming everyone.
  const allowed = await checkRateLimit(admin, `admin-broadcast:${admin_user.id}`, {
    maxHits: 10,
    windowSeconds: 300,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Terlalu banyak broadcast dalam waktu singkat, coba lagi sebentar." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const message = typeof body?.body === "string" ? body.body.trim().slice(0, 2000) : "";

  if (!title || !message) {
    return NextResponse.json(
      { error: "invalid_broadcast", message: "Judul dan isi pesan wajib diisi." },
      { status: 400 }
    );
  }

  const { data, error } = await admin.rpc("send_broadcast", {
    p_admin_id: admin_user.id,
    p_title: title,
    p_body: message,
  });

  if (error) {
    return NextResponse.json({ error: "send_failed", message: "Gagal mengirim broadcast." }, { status: 500 });
  }

  return NextResponse.json({ broadcast: { id: data.id, title: data.title, body: data.body, createdAt: data.created_at } });
}
