import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

const COLUMNS =
  "id, name, subtypes, category, phone, email, address, street, city, postal_code, area, neighborhood, country_code, verified, rating, reviews, location_link, website, instagram, facebook, linkedin, x_twitter, youtube, working_hours, business_status, outcomes, callback_at, follow_up_method, not_interested_reason, outscraper_place_id, latitude, longitude";

const PAGE_SIZE = 1000; // Supabase PostgREST hard cap

export async function GET() {
  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Paginate internally to get all rows past the 1000-row cap
  const all: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("companies")
      .select(COLUMNS)
      .order("postal_code", { ascending: true })
      .order("name", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  // Fetch latest note per company for "last_reached_out" and "latest_note_content" columns
  const { data: latestNotes } = await supabase
    .from("company_notes")
    .select("company_id, created_at, content")
    .order("created_at", { ascending: false });

  const lastReachedMap = new Map<string, string>();
  const latestNoteContentMap = new Map<string, string>();
  for (const note of latestNotes ?? []) {
    if (!lastReachedMap.has(note.company_id)) {
      lastReachedMap.set(note.company_id, note.created_at);
      latestNoteContentMap.set(note.company_id, note.content);
    }
  }

  // Fetch first contact per company
  const { data: allContacts } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: true });

  const contactMap = new Map<string, unknown>();
  for (const c of allContacts ?? []) {
    if (!contactMap.has(c.company_id)) contactMap.set(c.company_id, c);
  }

  const enriched = all.map((c) => ({
    ...c,
    last_reached_out: lastReachedMap.get(c.id as string) ?? null,
    latest_note_content: latestNoteContentMap.get(c.id as string) ?? null,
    contact: contactMap.get(c.id as string) ?? null,
  }));

  return NextResponse.json({ companies: enriched });
}
