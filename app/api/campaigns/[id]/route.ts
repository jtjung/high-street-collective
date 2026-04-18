import { NextResponse } from "next/server";
import { getAuth } from "@/lib/get-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

const MEMBER_COMPANY_COLUMNS =
  "id, name, subtypes, phone, email, address, postal_code, area, neighborhood, website, rating, reviews, verified, outcomes, contact_name, contact_address, contact_method";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await getAuth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !campaign)
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });

  const { data: members, error: memberError } = await supabase
    .from("campaign_members")
    .select(`added_at, company:companies(${MEMBER_COMPANY_COLUMNS})`)
    .eq("campaign_id", id)
    .order("added_at", { ascending: true });
  if (memberError)
    return NextResponse.json({ error: memberError.message }, { status: 500 });

  return NextResponse.json({ campaign, members: members ?? [] });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await getAuth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
