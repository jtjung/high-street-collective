"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { NavTabs } from "@/components/NavTabs";
import { Check, Pencil, TrendingUp, X } from "lucide-react";

type GoalsData = {
  settings: {
    price_per_customer_gbp: number;
    monthly_mrr_goal_gbp: number;
  };
  totalActiveCustomers: number;
  currentMRR: number;
  currentARR: number;
  thisMonth: {
    newCustomers: number;
    churned: number;
    netNew: number;
    revenue: number;
  };
  monthlyHistory: Array<{
    month: string;
    newCustomers: number;
    churned: number;
    netRevenue: number;
  }>;
  velocity: {
    avgNewPerMonth: number;
    avgChurnPerMonth: number;
  };
};

const MILESTONES = [
  { label: "Quit jobs", arrGbp: 80_000 },
  { label: "£100K ARR", arrGbp: 100_000 },
  { label: "£250K ARR", arrGbp: 250_000 },
  { label: "£500K ARR", arrGbp: 500_000 },
  { label: "£1M ARR", arrGbp: 1_000_000 },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function etaLabel(monthsFromNow: number): string {
  if (!isFinite(monthsFromNow) || monthsFromNow < 0) return "—";
  const d = new Date();
  d.setMonth(d.getMonth() + Math.round(monthsFromNow));
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function InlineNumberEdit({
  label,
  value,
  prefix,
  onSave,
}: {
  label: string;
  value: number;
  prefix: string;
  onSave: (v: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  async function save() {
    const n = Number(draft);
    if (isNaN(n) || n <= 0) { setEditing(false); setDraft(String(value)); return; }
    setSaving(true);
    await onSave(n);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-muted-foreground text-sm">{label}:</span>
        <span className="text-sm">{prefix}</span>
        <input
          ref={inputRef}
          className="w-20 border rounded px-1.5 py-0.5 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setDraft(String(value)); } }}
          disabled={saving}
        />
        <button onClick={save} disabled={saving} className="text-green-600 hover:text-green-700"><Check className="h-3.5 w-3.5" /></button>
        <button onClick={() => { setEditing(false); setDraft(String(value)); }} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1 group text-sm"
    >
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{prefix}{value.toLocaleString("en-GB")}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

export function GoalsClient() {
  const [data, setData] = useState<GoalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/goals");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function saveSetting(key: "price_per_customer_gbp" | "monthly_mrr_goal_gbp", value: number) {
    await fetch("/api/goals/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    // Optimistically update local state
    setData((prev) => prev ? { ...prev, settings: { ...prev.settings, [key]: value } } : prev);
    // Refetch to recalculate derived metrics
    fetchData();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
        Loading goals...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-destructive text-sm">
        {error ?? "Failed to load"}
      </div>
    );
  }

  const { settings, totalActiveCustomers, currentMRR, currentARR, thisMonth, monthlyHistory, velocity } = data;
  const netVelocity = velocity.avgNewPerMonth - velocity.avgChurnPerMonth;
  const goalProgress = Math.min(1, thisMonth.revenue / settings.monthly_mrr_goal_gbp);
  const goalPct = Math.round(goalProgress * 100);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-4 pt-2.5 pb-0 shrink-0">
        <div className="flex items-center justify-between gap-2 pb-2.5">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight">Goals</h1>
            <p className="text-[10px] text-muted-foreground">{totalActiveCustomers} active customers</p>
          </div>
          <UserButton />
        </div>
        <NavTabs />
      </header>

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-8">

        {/* Settings */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 items-center rounded-lg border bg-muted/30 px-4 py-2.5">
          <InlineNumberEdit
            label="Price per pub"
            value={settings.price_per_customer_gbp}
            prefix="£"
            onSave={(v) => saveSetting("price_per_customer_gbp", v)}
          />
          <span className="text-muted-foreground text-sm">/month</span>
          <span className="text-muted-foreground select-none">·</span>
          <InlineNumberEdit
            label="Monthly MRR goal"
            value={settings.monthly_mrr_goal_gbp}
            prefix="£"
            onSave={(v) => saveSetting("monthly_mrr_goal_gbp", v)}
          />
        </div>

        {/* Headline metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">This month</p>
            <p className="text-2xl font-bold">{thisMonth.newCustomers}</p>
            <p className="text-xs text-muted-foreground">new {thisMonth.newCustomers === 1 ? "customer" : "customers"}</p>
            {thisMonth.churned > 0 && (
              <p className="text-xs text-destructive">−{thisMonth.churned} churned</p>
            )}
          </div>
          <div className="rounded-xl border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Monthly revenue</p>
            <p className="text-2xl font-bold">{fmt(thisMonth.revenue)}</p>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Goal: {fmt(settings.monthly_mrr_goal_gbp)}</span>
                <span className={goalPct >= 100 ? "text-green-600 font-medium" : ""}>{goalPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${goalPct >= 100 ? "bg-green-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, goalPct)}%` }}
                />
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Current MRR</p>
            <p className="text-2xl font-bold">{fmt(currentMRR)}</p>
            <p className="text-xs text-muted-foreground">{totalActiveCustomers} active pubs</p>
          </div>
          <div className="rounded-xl border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">ARR run rate</p>
            <p className="text-2xl font-bold">{fmt(currentARR)}</p>
            <p className="text-xs text-muted-foreground">MRR × 12</p>
          </div>
        </div>

        {/* Velocity */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Velocity (last 3 months avg)</h2>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">New: </span>
              <span className="font-medium">{velocity.avgNewPerMonth}/month</span>
            </div>
            {velocity.avgChurnPerMonth > 0 && (
              <div>
                <span className="text-muted-foreground">Churned: </span>
                <span className="font-medium text-destructive">−{velocity.avgChurnPerMonth}/month</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Net growth: </span>
              <span className={`font-medium ${netVelocity > 0 ? "text-green-600" : netVelocity < 0 ? "text-destructive" : ""}`}>
                {netVelocity > 0 ? "+" : ""}{Math.round(netVelocity * 10) / 10}/month
              </span>
            </div>
          </div>
        </div>

        {/* Milestone projections */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h2 className="text-sm font-semibold">Milestone Projections</h2>
            {netVelocity <= 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">Sign more customers than you churn to unlock ETAs</p>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium">Milestone</th>
                <th className="text-right px-4 py-2.5 font-medium">ARR target</th>
                <th className="text-right px-4 py-2.5 font-medium">MRR needed</th>
                <th className="text-right px-4 py-2.5 font-medium">Customers</th>
                <th className="text-right px-4 py-2.5 font-medium">Still need</th>
                <th className="text-right px-4 py-2.5 font-medium">ETA</th>
              </tr>
            </thead>
            <tbody>
              {MILESTONES.map((m) => {
                const mrrNeeded = Math.ceil(m.arrGbp / 12);
                const customersNeeded = Math.ceil(mrrNeeded / settings.price_per_customer_gbp);
                const gap = Math.max(0, customersNeeded - totalActiveCustomers);
                const monthsToGo = netVelocity > 0 ? gap / netVelocity : Infinity;
                const done = gap === 0;
                return (
                  <tr key={m.label} className={`border-b last:border-0 ${done ? "bg-green-50/50" : ""}`}>
                    <td className="px-4 py-3 font-medium">
                      {done && <span className="text-green-600 mr-1.5">✓</span>}
                      {m.label}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(m.arrGbp)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(mrrNeeded)}</td>
                    <td className="px-4 py-3 text-right">{customersNeeded.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {done ? <span className="text-green-600 font-medium">Done</span> : <span className="text-muted-foreground">+{gap}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {done ? <span className="text-green-600">Now</span> : etaLabel(monthsToGo)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Monthly history */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h2 className="text-sm font-semibold">Monthly History</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium">Month</th>
                <th className="text-right px-4 py-2.5 font-medium">New</th>
                <th className="text-right px-4 py-2.5 font-medium">Churned</th>
                <th className="text-right px-4 py-2.5 font-medium">Net</th>
                <th className="text-right px-4 py-2.5 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[...monthlyHistory].reverse().map((row) => {
                const net = row.newCustomers - row.churned;
                return (
                  <tr key={row.month} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{fmtMonth(row.month)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {row.newCustomers > 0 ? <span className="text-green-600">+{row.newCustomers}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {row.churned > 0 ? <span className="text-destructive">−{row.churned}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={net > 0 ? "text-green-600" : net < 0 ? "text-destructive" : "text-muted-foreground"}>
                        {net > 0 ? `+${net}` : net === 0 ? "—" : net}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {row.netRevenue !== 0 ? fmt(row.netRevenue) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
