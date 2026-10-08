import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { getProviderProducts } from "@/lib/provider/vipibmstore";

export async function GET(request: Request) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  const result = await getProviderProducts({ fresh });

  if (!result.success) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: 502 });
  }

  return NextResponse.json({ products: result.data });
}
