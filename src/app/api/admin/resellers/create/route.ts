import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Admin-only: create a new reseller account (auth.users row + matching
 * public.users row) directly from the admin panel, without the reseller
 * needing to self-register via /login's sign-up flow first.
 *
 * Mirrors scripts/create-admin.js's createUser + upsert pattern, but as
 * a route handler (role stays 'user', not 'admin') and with a
 * generated password instead of one typed into a one-off terminal
 * command -- the admin copies/shares it however they normally reach the
 * reseller (WhatsApp, etc.), and the reseller can change it later via
 * Supabase's password-reset flow if a "change password" screen doesn't
 * exist yet.
 */

function randomPassword() {
  // 12 hex chars (~48 bits) -- well above Supabase Auth's 6-char
  // minimum, meant to be copy-pasted once and optionally changed later,
  // not memorized.
  return randomBytes(9).toString("base64url");
}

export async function POST(request: Request) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const allowed = await checkRateLimit(admin, `admin-create-reseller:${admin_user.id}`, {
    maxHits: 20,
    windowSeconds: 60,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Terlalu banyak percobaan, coba lagi sebentar." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim().slice(0, 120) : "";
  const initialBalance = Math.trunc(Number(body?.initialBalance) || 0);
  const customPassword = typeof body?.password === "string" ? body.password.trim() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email", message: "Email tidak valid." }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ error: "invalid_name", message: "Nama wajib diisi." }, { status: 400 });
  }
  if (customPassword && customPassword.length < 6) {
    return NextResponse.json(
      { error: "invalid_password", message: "Password minimal 6 karakter." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(initialBalance) || initialBalance < 0) {
    return NextResponse.json({ error: "invalid_balance", message: "Saldo awal tidak valid." }, { status: 400 });
  }

  const { data: existingList, error: listError } = await admin.auth.admin.listUsers();
  if (listError) {
    return NextResponse.json(
      { error: "list_failed", message: listError.message },
      { status: 500 }
    );
  }
  if (existingList.users.some((u) => u.email?.toLowerCase() === email)) {
    return NextResponse.json(
      { error: "email_taken", message: "Email ini sudah terdaftar." },
      { status: 409 }
    );
  }

  const password = customPassword || randomPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created?.user) {
    return NextResponse.json(
      { error: "create_failed", message: createError?.message || "Gagal membuat akun." },
      { status: 500 }
    );
  }

  const userId = created.user.id;

  // Same belt-and-suspenders upsert as scripts/create-admin.js: the
  // handle_new_auth_user trigger (0001_init.sql) already inserts this
  // row with role='user', but we upsert explicitly so the initial
  // balance and full_name land atomically even if the trigger is slow
  // to complete, and so this endpoint stays correct if the trigger ever
  // changes.
  const { error: upsertError } = await admin
    .from("users")
    .upsert(
      { id: userId, email, full_name: fullName, role: "user", verified: true, balance: initialBalance },
      { onConflict: "id" }
    );

  if (upsertError) {
    // Auth user now exists but the profile row failed -- clean up so a
    // retry with the same email doesn't hit email_taken above for a
    // half-created account.
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json(
      { error: "profile_failed", message: upsertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: userId,
    email,
    fullName,
    balance: initialBalance,
    password: customPassword ? null : password,
  });
}
