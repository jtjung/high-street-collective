import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";
import { getCurrentUserEmail } from "@/lib/admin";

export async function GET() {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .order("entry_date", { ascending: false })
    .limit(90);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(request: Request) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { entry_date, content } = (await request.json()) as { entry_date: string; content: string };
  if (!entry_date || !content?.trim()) {
    return NextResponse.json({ error: "entry_date and content are required" }, { status: 400 });
  }

  const email = await getCurrentUserEmail();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({ entry_date, content: content.trim(), created_by: email })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, content } = (await request.json()) as { id: string; content: string };
  if (!id || !content?.trim()) {
    return NextResponse.json({ error: "id and content are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("journal_entries")
    .update({ content: content.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("journal_entries").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
