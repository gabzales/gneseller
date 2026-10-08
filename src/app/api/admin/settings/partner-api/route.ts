import { NextResponse } from "next/server";
import { maskSecret } from "@/lib/mask-secret";
import { randomBytes, randomUUID } from "crypto";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";
import { normalizePartnerKeys, type PartnerKey } from "@/lib/provider/partner-auth";

// MULTI-KEY (Sep 2026): satu toko client = satu key + satu akun reseller
// sendiri. Data disimpan di app_settings 'partner_api' sebagai
// { keys: [...] }; bentuk lama ({ apiKey, resellerId }) otomatis terbaca
// sebagai satu key "Default" oleh normalizePartnerKeys() dan baru berubah
// jadi bentuk baru saat admin menyimpan sesuatu dari panel.
//
//   GET     -> daftar key (apiKey selalu masked)
//   POST    { label, resellerEmail }                   -> key baru (apiKey mentah dikembalikan SEKALI)
//   PUT     { id, label?, resellerEmail?, active?, regenerate? }
//   DELETE  { id }

const MAX_KEYS = 25;

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabase>>;


function newApiKey() {
  return `gs_partner_${randomBytes(24).toString("hex")}`;
}

async function loadKeys(admin: AdminClient) {
  const { data } = await admin.from("app_settings").select("value").eq("key", "partner_api").maybeSingle();
  return normalizePartnerKeys(data?.value as Parameters<typeof normalizePartnerKeys>[0]);
}

async function saveKeys(admin: AdminClient, keys: PartnerKey[]) {
  return admin
    .from("app_settings")
    .upsert({ key: "partner_api", value: { keys }, updated_at: new Date().toISOString() });
}

async function resolveReseller(admin: AdminClient, emailRaw: unknown): Promise<{ id: string } | { error: NextResponse }> {
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  if (!email) {
    return {
      error: NextResponse.json(
        { error: "missing_reseller_email", message: "Email reseller (akun partner) wajib diisi." },
        { status: 400 }
      ),
    };
  }
  const { data: reseller } = await admin.from("users").select("id").ilike("email", email).eq("role", "user").maybeSingle();
  if (!reseller) {
    return {
      error: NextResponse.json(
        { error: "reseller_not_found", message: "Gak ketemu akun reseller dengan email itu -- cek lagi di Kelola Reseller, harus persis sama." },
        { status: 404 }
      ),
    };
  }
  return { id: reseller.id as string };
}

export async function GET() {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const keys = await loadKeys(admin);

  // Resolve id -> email sekali jalan buat semua key (admin gak ngapalin UUID).
  const ids = Array.from(new Set(keys.map((k) => k.resellerId).filter(Boolean)));
  const emailById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: users } = await admin.from("users").select("id, email").in("id", ids);
    for (const u of users || []) emailById.set(u.id as string, (u.email as string) || "");
  }

  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      label: k.label,
      apiKeyMasked: maskSecret(k.apiKey),
      resellerEmail: emailById.get(k.resellerId) || "",
      resellerLinked: Boolean(k.resellerId),
      active: k.active,
      createdAt: k.createdAt,
    })),
    configured: keys.some((k) => k.active && k.resellerId),
  });
}

export async function POST(request: Request) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 60) : "";
  if (!label) {
    return NextResponse.json({ error: "missing_label", message: "Nama key wajib diisi (mis. nama toko client)." }, { status: 400 });
  }

  const reseller = await resolveReseller(admin, body?.resellerEmail);
  if ("error" in reseller) return reseller.error;

  const keys = await loadKeys(admin);
  if (keys.length >= MAX_KEYS) {
    return NextResponse.json({ error: "too_many_keys", message: `Maksimal ${MAX_KEYS} key.` }, { status: 400 });
  }

  const apiKey = newApiKey();
  keys.push({
    id: randomUUID(),
    label,
    apiKey,
    resellerId: reseller.id,
    active: true,
    createdAt: new Date().toISOString(),
  });

  const { error } = await saveKeys(admin, keys);
  if (error) return NextResponse.json({ error: "save_failed", message: error.message }, { status: 500 });

  // apiKey mentah HANYA dikembalikan sekali ini -- setelahnya GET selalu masked.
  return NextResponse.json({ ok: true, apiKey });
}

export async function PUT(request: Request) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const id = typeof body?.id === "string" ? body.id : "";
  const keys = await loadKeys(admin);
  const target = keys.find((k) => k.id === id);
  if (!target) return NextResponse.json({ error: "key_not_found", message: "Key tidak ditemukan." }, { status: 404 });

  if (typeof body.label === "string") {
    const label = body.label.trim().slice(0, 60);
    if (!label) return NextResponse.json({ error: "missing_label", message: "Nama key tidak boleh kosong." }, { status: 400 });
    target.label = label;
  }
  if (typeof body.resellerEmail === "string") {
    const reseller = await resolveReseller(admin, body.resellerEmail);
    if ("error" in reseller) return reseller.error;
    target.resellerId = reseller.id;
  }
  if (typeof body.active === "boolean") target.active = body.active;

  let regeneratedKey: string | undefined;
  if (body.regenerate) {
    regeneratedKey = newApiKey();
    target.apiKey = regeneratedKey;
  }

  // Key bentuk lama ("legacy"/"env") dapat id permanen begitu disimpan dari
  // panel, supaya seterusnya bisa dirujuk seperti key lain.
  if (target.id === "legacy" || target.id === "env") target.id = randomUUID();

  const { error } = await saveKeys(admin, keys);
  if (error) return NextResponse.json({ error: "save_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, apiKey: regeneratedKey });
}

export async function DELETE(request: Request) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const id = typeof body?.id === "string" ? body.id : "";
  const keys = await loadKeys(admin);
  const remaining = keys.filter((k) => k.id !== id);
  if (remaining.length === keys.length) {
    return NextResponse.json({ error: "key_not_found", message: "Key tidak ditemukan." }, { status: 404 });
  }

  const { error } = await saveKeys(admin, remaining);
  if (error) return NextResponse.json({ error: "save_failed", message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
