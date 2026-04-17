import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

function toMonthKey(iso: string) {
  return iso.slice(0, 7); // "2026-04"
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return toMonthKey(d.toISOString());
}

export async function GET() {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const [settingsRes, oppsRes] = await Promise.all([
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["price_per_customer_gbp", "monthly_mrr_goal_gbp"]),
    supabase
      .from("opportunities")
      .select("id, status, won_at, churned_at, created_at, updated_at")
      .in("status", ["customer", "churned"]),
  ]);

  if (settingsRes.error) return NextResponse.json({ error: settingsRes.error.message }, { status: 500 });
  if (oppsRes.error) return NextResponse.json({ error: oppsRes.error.message }, { status: 500 });

  const settingsMap = Object.fromEntries(
    (settingsRes.data ?? []).map((r) => [r.key, Number(r.value)])
  );
  const price = settingsMap.price_per_customer_gbp ?? 200;
  const monthlyGoal = settingsMap.monthly_mrr_goal_gbp ?? 3000;

  const opportunities = oppsRes.data ?? [];
  const thisMonth = toMonthKey(new Date().toISOString());

  // Active customers (not churned)
  const activeCustomers = opportunities.filter((o) => o.status === "customer");
  const totalActiveCustomers = activeCustomers.length;
  const currentMRR = totalActiveCustomers * price;
  const currentARR = currentMRR * 12;

  // Build per-month buckets for last 12 months
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) months.push(monthsAgo(i));

  type MonthBucket = { newCustomers: number; churned: number };
  const buckets = new Map<string, MonthBucket>(months.map((m) => [m, { newCustomers: 0, churned: 0 }]));

  for (const opp of opportunities) {
    if (opp.won_at) {
      const m = toMonthKey(opp.won_at);
      if (buckets.has(m)) buckets.get(m)!.newCustomers++;
    }
    if (opp.churned_at) {
      const m = toMonthKey(opp.churned_at);
      if (buckets.has(m)) buckets.get(m)!.churned++;
    }
  }

  const monthlyHistory = months.map((month) => {
    const b = buckets.get(month)!;
    return {
      month,
      newCustomers: b.newCustomers,
      churned: b.churned,
      netRevenue: (b.newCustomers - b.churned) * price,
    };
  });

  const thisMonthBucket = buckets.get(thisMonth) ?? { newCustomers: 0, churned: 0 };

  // Velocity: average over last 3 complete months (exclude current month)
  const last3 = months.slice(-4, -1); // 3 complete months before current
  const avgNewPerMonth =
    last3.reduce((s, m) => s + (buckets.get(m)?.newCustomers ?? 0), 0) / 3;
  const avgChurnPerMonth =
    last3.reduce((s, m) => s + (buckets.get(m)?.churned ?? 0), 0) / 3;

  return NextResponse.json({
    settings: { price_per_customer_gbp: price, monthly_mrr_goal_gbp: monthlyGoal },
    totalActiveCustomers,
    currentMRR,
    currentARR,
    thisMonth: {
      newCustomers: thisMonthBucket.newCustomers,
      churned: thisMonthBucket.churned,
      netNew: thisMonthBucket.newCustomers - thisMonthBucket.churned,
      revenue: thisMonthBucket.newCustomers * price,
    },
    monthlyHistory,
    velocity: {
      avgNewPerMonth: Math.round(avgNewPerMonth * 10) / 10,
      avgChurnPerMonth: Math.round(avgChurnPerMonth * 10) / 10,
    },
  });
}
