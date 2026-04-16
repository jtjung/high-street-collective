import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
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
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
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
