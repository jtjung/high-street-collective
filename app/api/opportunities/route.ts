import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

const COMPANY_COLUMNS =
  "id, name, subtypes, category, phone, email, address, street, city, postal_code, area, neighborhood, website, instagram, facebook, linkedin, rating, reviews, location_link, verified, outcomes, pain_points, user_goals, contact_name, contact_address, contact_method, contact_notes";

export async function GET() {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("opportunities")
    .select(`*, company:companies(${COMPANY_COLUMNS})`)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ opportunities: data ?? [] });
}

export async function POST(request: Request) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { company_id } = (await request.json()) as { company_id: string };
  if (!company_id) return NextResponse.json({ error: "company_id required" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // Return existing if already an opportunity
  const { data: existing } = await supabase
    .from("opportunities")
    .select("*")
    .eq("company_id", company_id)
    .maybeSingle();

  if (existing) return NextResponse.json({ opportunity: existing });

  const { data, error } = await supabase
    .from("opportunities")
    .insert({ company_id, status: "send_website" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ opportunity: data }, { status: 201 });
}
