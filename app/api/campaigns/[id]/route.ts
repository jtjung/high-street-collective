import { NextResponse } from "next/server";
import { getAuth } from "@/lib/get-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

const MEMBER_COMPANY_COLUMNS =
  "id, name, subtypes, phone, email, address, postal_code, area, neighborhood, website, rating, reviews, verified, outcomes, latitude, longitude, location_link, prototype_url";

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

  // Fetch first contact per member company so campaign detail can surface it
  const companyIds = (members ?? [])
    .map((m: { company: { id: string } | null }) => m.company?.id)
    .filter((id: string | undefined): id is string => !!id);

  const contactMap = new Map<string, { name: string | null; email: string | null; phone: string | null }>();
  if (companyIds.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("company_id, name, email, phone, created_at")
      .in("company_id", companyIds)
      .order("created_at", { ascending: true });
    for (const c of contacts ?? []) {
      if (!contactMap.has(c.company_id)) {
        contactMap.set(c.company_id, { name: c.name, email: c.email, phone: c.phone });
      }
    }
  }

  type MemberRow = {
    added_at: string;
    company: Record<string, unknown> & { id: string } | null;
  };
  const enriched = (members as MemberRow[] | null ?? []).map((m) => ({
    ...m,
    company: m.company
      ? { ...m.company, contact: contactMap.get(m.company.id) ?? null }
      : null,
  }));

  return NextResponse.json({ campaign, members: enriched });
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
