import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";

const MAX_KEYS_PER_PASTE = 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; durationId: string }> }
) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id: productId, durationId } = await params;
  const body = await request.json().catch(() => null);

  // Accept either a raw newline-separated blob (what the admin pastes in
  // the textarea) or an already-split array.
  const raw: string[] = Array.isArray(body?.keys)
    ? body.keys
    : typeof body?.keysText === "string"
      ? body.keysText.split("\n")
      : [];

  const keys = Array.from(
    new Set(raw.map((k) => String(k).trim()).filter(Boolean))
  ).slice(0, MAX_KEYS_PER_PASTE);

  if (keys.length === 0) return NextResponse.json({ error: "no_keys" }, { status: 400 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { error, count } = await admin
    .from("key_stock")
    .insert(
      keys.map((key_string) => ({ product_id: productId, duration_id: durationId, key_string })),
      { count: "exact" }
    );

  if (error) return NextResponse.json({ error: "insert_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ added: count ?? keys.length });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; durationId: string }> }) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id: productId, durationId } = await params;
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { data, error } = await admin
    .from("key_stock")
    .select("id, key_string, created_at")
    .eq("product_id", productId)
    .eq("duration_id", durationId)
    .eq("used", false)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ keys: data ?? [] });
}
