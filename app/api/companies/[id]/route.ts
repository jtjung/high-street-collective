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

  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("company_id", id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ company, notes: notes ?? [], contact: contact ?? null });
}

type CompanyPatch = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  postal_code?: string | null;
  outcomes?: string[];
  callback_at?: string | null;
  calendar_event_id?: string | null;
  last_called_at?: string | null;
  not_interested_reason?: string | null;
  follow_up_method?: string | null;
};

const ALLOWED_FIELDS: Array<keyof CompanyPatch> = [
  "name",
  "phone",
  "email",
  "website",
  "address",
  "postal_code",
  "outcomes",
  "callback_at",
  "calendar_event_id",
  "last_called_at",
  "not_interested_reason",
  "follow_up_method",
];

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
  for (const k of ALLOWED_FIELDS) {
    if (body[k] !== undefined) {
      // @ts-expect-error — index signature is narrow on purpose
      update[k] = body[k];
    }
  }

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
