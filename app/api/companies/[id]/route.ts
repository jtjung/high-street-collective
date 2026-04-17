import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  const { data: notes } = await supabase
    .from("company_notes")
    .select("*")
    .eq("company_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ company, notes: notes ?? [] });
}

type CompanyPatch = {
  outcomes?: string[];
  callback_at?: string | null;
  calendar_event_id?: string | null;
  last_called_at?: string | null;
  not_interested_reason?: string | null;
  pain_points?: string[];
  user_goals?: string[];
  manager_name?: string | null;
  owner_name?: string | null;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as CompanyPatch;
  const supabase = getSupabaseAdmin();

  const update: CompanyPatch = {};
  if (body.outcomes !== undefined) update.outcomes = body.outcomes;
  if (body.callback_at !== undefined) update.callback_at = body.callback_at;
  if (body.calendar_event_id !== undefined)
    update.calendar_event_id = body.calendar_event_id;
  if (body.last_called_at !== undefined)
    update.last_called_at = body.last_called_at;
  if (body.not_interested_reason !== undefined)
    update.not_interested_reason = body.not_interested_reason;
  if (body.pain_points !== undefined) update.pain_points = body.pain_points;
  if (body.user_goals !== undefined) update.user_goals = body.user_goals;
  if (body.manager_name !== undefined) update.manager_name = body.manager_name;
  if (body.owner_name !== undefined) update.owner_name = body.owner_name;

  const { data, error } = await supabase
    .from("companies")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
