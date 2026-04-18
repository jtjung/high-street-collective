import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/get-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

const ALLOWED_METHODS = new Set(["phone", "email", "in_person", "mail", "other"]);

export async function GET() {
  const { userId } = await getAuth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  // One round-trip: campaigns + member counts via aggregated join.
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("campaign_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (campaigns ?? []).map((c) => c.id);
  let counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: members } = await supabase
      .from("campaign_members")
      .select("campaign_id")
      .in("campaign_id", ids);
    counts = (members ?? []).reduce((acc, m) => {
      acc.set(m.campaign_id, (acc.get(m.campaign_id) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
  }

  return NextResponse.json({
    campaigns: (campaigns ?? []).map((c) => ({
      ...c,
      member_count: counts.get(c.id) ?? 0,
    })),
  });
}

type CreateBody = {
  name: string;
  method: string;
  campaign_date: string;
  notes?: string | null;
  company_ids: string[];
};

export async function POST(request: Request) {
  const { userId } = await getAuth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as CreateBody;
  const name = body.name?.trim();
  const method = body.method?.trim();
  const campaign_date = body.campaign_date?.trim();
  const company_ids = Array.isArray(body.company_ids) ? body.company_ids : [];

  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!ALLOWED_METHODS.has(method))
    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  if (!campaign_date)
    return NextResponse.json({ error: "Date required" }, { status: 400 });
  if (company_ids.length === 0)
    return NextResponse.json(
      { error: "Select at least one company" },
      { status: 400 }
    );

  let email: string | null = null;
  let displayName: string | null = null;
  if (process.env.AUTH_BYPASS !== "true") {
    const { userId: clerkUserId } = await auth();
    if (clerkUserId) {
      const client = await clerkClient();
      const user = await client.users.getUser(clerkUserId);
      email = user.primaryEmailAddress?.emailAddress ?? null;
      displayName = user.firstName
        ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
        : email?.split("@")[0] ?? null;
    }
  } else {
    email = "dev@bypass.local";
    displayName = "Dev User";
  }

  const supabase = getSupabaseAdmin();
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      name,
      method,
      campaign_date,
      notes: body.notes?.trim() || null,
      created_by_user_id: userId,
      created_by_user_email: email,
      created_by_user_name: displayName,
    })
    .select()
    .single();

  if (error || !campaign)
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });

  const rows = company_ids.map((company_id) => ({
    campaign_id: campaign.id,
    company_id,
  }));
  const { error: memberError } = await supabase
    .from("campaign_members")
    .insert(rows);
  if (memberError) {
    // Roll back the campaign so we don't leak empty records.
    await supabase.from("campaigns").delete().eq("id", campaign.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json(
    { campaign: { ...campaign, member_count: rows.length } },
    { status: 201 }
  );
}
