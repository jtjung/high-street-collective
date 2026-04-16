import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabaseAdmin();

  // Insert call log
  const { data: callLog, error: logError } = await supabase
    .from("call_logs")
    .insert({
      company_id: id,
      user_id: userId,
      user_email: body.userEmail,
      outcome: body.outcome,
      callback_datetime: body.callbackDatetime || null,
      calendar_event_id: body.calendarEventId || null,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  // Update company status
  const { error: updateError } = await supabase
    .from("companies")
    .update({
      status: body.outcome,
      last_called_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  // Save notes if provided
  if (body.notes) {
    await supabase.from("company_notes").insert({
      company_id: id,
      user_id: userId,
      content: body.notes,
    });
  }

  return NextResponse.json(callLog);
}
