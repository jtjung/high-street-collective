import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

type ContactPatch = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: companyId } = await params;
  const body = (await request.json()) as ContactPatch;
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("contacts")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const payload = {
    name: body.name ?? null,
    email: body.email ?? null,
    phone: body.phone ?? null,
    notes: body.notes ?? null,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("contacts")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({ company_id: companyId, ...payload })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
