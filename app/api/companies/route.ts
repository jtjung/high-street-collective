import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Fetch all companies (~2600 records, ~1-2MB JSON — fits fine in one response)
  const { data: companies, error } = await supabase
    .from("companies")
    .select(
      "id, name, subtypes, category, phone, email, address, street, city, postal_code, country_code, verified, rating, reviews, location_link, website, instagram, facebook, linkedin, x_twitter, youtube, business_status, outcomes, callback_at, outscraper_place_id"
    )
    .order("postal_code", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch latest note date per company for "last_reached_out" column
  const { data: latestNotes } = await supabase
    .from("company_notes")
    .select("company_id, created_at")
    .order("created_at", { ascending: false });

  const lastReachedMap = new Map<string, string>();
  for (const note of latestNotes ?? []) {
    if (!lastReachedMap.has(note.company_id)) {
      lastReachedMap.set(note.company_id, note.created_at);
    }
  }

  const enriched = (companies ?? []).map((c) => ({
    ...c,
    last_reached_out: lastReachedMap.get(c.id) ?? null,
  }));

  return NextResponse.json({ companies: enriched });
}
