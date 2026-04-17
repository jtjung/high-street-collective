import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

type OpportunityPatch = {
  status?: string;
  sample_website?: string | null;
  sent_date?: string | null;
  follow_up_date?: string | null;
  discovery_meeting_contact?: string | null;
  discovery_meeting_at?: string | null;
  discovery_calendar_event_id?: string | null;
  pilot_start_date?: string | null;
  pilot_end_date?: string | null;
  won_at?: string | null;
  churned_at?: string | null;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json()) as OpportunityPatch;
  const supabase = getSupabaseAdmin();

  const update: OpportunityPatch = {};
  if (body.status !== undefined) update.status = body.status;
  if (body.sample_website !== undefined) update.sample_website = body.sample_website;
  if (body.sent_date !== undefined) update.sent_date = body.sent_date;
  if (body.follow_up_date !== undefined) update.follow_up_date = body.follow_up_date;
  if (body.discovery_meeting_contact !== undefined) update.discovery_meeting_contact = body.discovery_meeting_contact;
  if (body.discovery_meeting_at !== undefined) update.discovery_meeting_at = body.discovery_meeting_at;
  if (body.discovery_calendar_event_id !== undefined) update.discovery_calendar_event_id = body.discovery_calendar_event_id;
  if (body.pilot_start_date !== undefined) update.pilot_start_date = body.pilot_start_date;
  if (body.pilot_end_date !== undefined) update.pilot_end_date = body.pilot_end_date;

  // Stamp conversion timestamps automatically on status transitions
  if (body.status === "customer") update.won_at = new Date().toISOString();
  if (body.status === "churned") update.churned_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("opportunities")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
