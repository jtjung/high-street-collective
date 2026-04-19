import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

export async function GET(request: Request) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ companies: [] });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, address, postal_code, area")
    .or(`name.ilike.%${q}%,postal_code.ilike.%${q}%,address.ilike.%${q}%`)
    .order("name", { ascending: true })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ companies: data ?? [] });
}
