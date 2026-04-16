import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, attemptId } = await params;
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("call_attempts")
    .delete()
    .eq("id", attemptId)
    .eq("company_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
