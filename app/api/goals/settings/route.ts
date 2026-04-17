import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

export async function GET() {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["price_per_customer_gbp", "monthly_mrr_goal_gbp"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const settings = Object.fromEntries((data ?? []).map((r) => [r.key, Number(r.value)]));
  return NextResponse.json({
    price_per_customer_gbp: settings.price_per_customer_gbp ?? 200,
    monthly_mrr_goal_gbp: settings.monthly_mrr_goal_gbp ?? 3000,
  });
}

export async function PATCH(request: Request) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Partial<{
    price_per_customer_gbp: number;
    monthly_mrr_goal_gbp: number;
  }>;

  const supabase = getSupabaseAdmin();
  const upserts = [];

  if (body.price_per_customer_gbp !== undefined) {
    upserts.push({ key: "price_per_customer_gbp", value: body.price_per_customer_gbp, updated_at: new Date().toISOString() });
  }
  if (body.monthly_mrr_goal_gbp !== undefined) {
    upserts.push({ key: "monthly_mrr_goal_gbp", value: body.monthly_mrr_goal_gbp, updated_at: new Date().toISOString() });
  }

  if (upserts.length === 0) return NextResponse.json({ ok: true });

  const { error } = await supabase.from("app_settings").upsert(upserts, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
