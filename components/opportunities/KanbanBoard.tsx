"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ArrowRight, Building2, XCircle, Trophy, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TransitionModal } from "./TransitionModal";
import { OpportunityPanel } from "./OpportunityPanel";
import type { Tables } from "@/lib/supabase/types";
import type { Company } from "@/lib/use-companies";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export type Opportunity = Tables<"opportunities"> & {
  company: Pick<
    Company,
    | "id"
    | "name"
    | "subtypes"
    | "category"
    | "phone"
    | "email"
    | "address"
    | "street"
    | "city"
    | "postal_code"
    | "area"
    | "neighborhood"
    | "website"
    | "instagram"
    | "facebook"
    | "linkedin"
    | "rating"
    | "reviews"
    | "location_link"
    | "verified"
    | "outcomes"
    | "pain_points"
    | "user_goals"
    | "manager_name"
    | "owner_name"
  > | null;
};

export const STATUSES = [
  { value: "send_website", label: "Send Website" },
  { value: "sent_website", label: "Sent Website" },
  { value: "discovery_meeting_booked", label: "Discovery Meeting Booked" },
  { value: "in_pilot", label: "In Pilot" },
  { value: "proposal", label: "Proposal" },
] as const;

export type StatusValue = (typeof STATUSES)[number]["value"];

const STATUS_COLORS: Record<StatusValue, string> = {
  send_website: "bg-slate-100 border-slate-200",
  sent_website: "bg-blue-50 border-blue-200",
  discovery_meeting_booked: "bg-violet-50 border-violet-200",
  in_pilot: "bg-amber-50 border-amber-200",
  proposal: "bg-green-50 border-green-200",
};

const STATUS_HEADER_COLORS: Record<StatusValue, string> = {
  send_website: "bg-slate-200 text-slate-800",
  sent_website: "bg-blue-100 text-blue-800",
  discovery_meeting_booked: "bg-violet-100 text-violet-800",
  in_pilot: "bg-amber-100 text-amber-800",
  proposal: "bg-green-100 text-green-800",
};

function OpportunityCard({
  opp,
  onCardClick,
  onAdvance,
  onLost,
  onWon,
  isLast,
}: {
  opp: Opportunity;
  onCardClick: (opp: Opportunity) => void;
  onAdvance: (opp: Opportunity) => void;
  onLost: (opp: Opportunity) => void;
  onWon: (opp: Opportunity) => void;
  isLast: boolean;
}) {
  const company = opp.company;
  return (
    <div
      className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => onCardClick(opp)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{company?.name ?? "Unknown"}</p>
          {company?.category && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{company.category}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
          {!isLast && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdvance(opp); }}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90"
              title="Advance to next stage"
            >
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onWon(opp); }}
            className="inline-flex items-center p-1 rounded-md text-muted-foreground hover:text-green-600 hover:bg-green-50"
            title="Mark as Deal Won"
          >
            <Trophy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onLost(opp); }}
            className="inline-flex items-center p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Mark as Deal Lost"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {(company?.area || company?.neighborhood || company?.postal_code) && (
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {[company.neighborhood, company.area, company.postal_code].filter(Boolean).join(" · ")}
        </p>
      )}

      {opp.status === "sent_website" && opp.follow_up_date && (
        <p className="text-xs text-blue-600 mt-1.5">
          Follow-up: {new Date(opp.follow_up_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </p>
      )}

      {opp.status === "discovery_meeting_booked" && opp.discovery_meeting_at && (
        <p className="text-xs text-violet-600 mt-1.5">
          Meeting: {new Date(opp.discovery_meeting_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}

      {opp.status === "in_pilot" && opp.pilot_end_date && (
        <p className="text-xs text-amber-600 mt-1.5">
          Ends: {new Date(opp.pilot_end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      )}

      {opp.status === "in_pilot" && opp.sample_website && (
        <a
          href={opp.sample_website.startsWith("http") ? opp.sample_website : `https://${opp.sample_website}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-primary hover:underline mt-1 block truncate"
        >
          {opp.sample_website.replace(/^https?:\/\//, "")}
        </a>
      )}

      {company?.subtypes && company.subtypes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {company.subtypes.slice(0, 2).map((s) => (
            <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
              {s}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function KanbanBoard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState<Opportunity | null>(null);
  const [panelOpp, setPanelOpp] = useState<Opportunity | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/opportunities");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { opportunities: Opportunity[] };
      setOpportunities(data.opportunities);
    } catch {
      toast.error("Failed to load opportunities");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const handleCardClick = useCallback((opp: Opportunity) => {
    setPanelOpp(opp);
    setPanelOpen(true);
  }, []);

  const handleAdvance = useCallback((opp: Opportunity) => {
    setTransitioning(opp);
  }, []);

  const handleLost = useCallback(async (opp: Opportunity) => {
    try {
      const res = await fetch(`/api/opportunities/${opp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "lost" }),
      });
      if (!res.ok) throw new Error("Failed");
      setOpportunities((prev) => prev.filter((o) => o.id !== opp.id));
      setPanelOpen(false);
      toast.success(`${opp.company?.name ?? "Opportunity"} marked as Deal Lost`);
    } catch {
      toast.error("Failed to mark as lost");
    }
  }, []);

  const handleWon = useCallback(async (opp: Opportunity) => {
    try {
      const res = await fetch(`/api/opportunities/${opp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "customer" }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json() as Opportunity;
      setOpportunities((prev) =>
        prev.map((o) => (o.id === opp.id ? { ...o, ...updated } : o))
      );
      setPanelOpen(false);
      toast.success(`${opp.company?.name ?? "Opportunity"} is now a Customer 🎉`);
    } catch {
      toast.error("Failed to mark as won");
    }
  }, []);

  const handleChurned = useCallback(async (opp: Opportunity) => {
    if (!confirm(`Mark ${opp.company?.name ?? "this customer"} as churned?`)) return;
    try {
      const res = await fetch(`/api/opportunities/${opp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "churned" }),
      });
      if (!res.ok) throw new Error("Failed");
      setOpportunities((prev) => prev.filter((o) => o.id !== opp.id));
      setPanelOpen(false);
      toast.success(`${opp.company?.name ?? "Customer"} marked as churned`);
    } catch {
      toast.error("Failed to mark as churned");
    }
  }, []);

  const handleTransitionComplete = useCallback((updated: Opportunity) => {
    setOpportunities((prev) =>
      prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
    );
    setTransitioning(null);
    if (panelOpp?.id === updated.id) {
      setPanelOpp((prev) => prev ? { ...prev, ...updated } : prev);
    }
  }, [panelOpp]);

  const handlePanelUpdate = useCallback((updated: Opportunity) => {
    setOpportunities((prev) =>
      prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
    );
    setPanelOpp((prev) => prev ? { ...prev, ...updated } : prev);
  }, []);

  const grouped = STATUSES.reduce<Record<string, Opportunity[]>>((acc, s) => {
    acc[s.value] = opportunities.filter((o) => o.status === s.value);
    return acc;
  }, {} as Record<string, Opportunity[]>);

  const customers = opportunities.filter((o) => o.status === "customer");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-4 py-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/leads" className="text-muted-foreground hover:text-foreground text-sm">
              ← Leads
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight">Opportunities</h1>
              <p className="text-[10px] text-muted-foreground">
                {opportunities.length} total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchOpportunities}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <Link
              href="/goals"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors"
            >
              Goals
            </Link>
            <UserButton />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Loading opportunities...
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 h-full min-h-[calc(100vh-80px)]" style={{ minWidth: `${(STATUSES.length + 1) * 280}px` }}>
            {STATUSES.map((status, idx) => {
              const cards = grouped[status.value] ?? [];
              const colorClass = STATUS_COLORS[status.value as StatusValue];
              const headerClass = STATUS_HEADER_COLORS[status.value as StatusValue];
              return (
                <div
                  key={status.value}
                  className={`flex flex-col rounded-xl border-2 ${colorClass} w-[272px] shrink-0`}
                >
                  <div className={`px-3 py-2 rounded-t-lg flex items-center justify-between ${headerClass}`}>
                    <span className="text-sm font-semibold">{status.label}</span>
                    <span className="text-xs font-medium opacity-70">{cards.length}</span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {cards.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                        <Building2 className="h-8 w-8 mb-2" />
                        <p className="text-xs">No opportunities</p>
                      </div>
                    ) : (
                      cards.map((opp) => (
                        <OpportunityCard
                          key={opp.id}
                          opp={opp}
                          onCardClick={handleCardClick}
                          onAdvance={handleAdvance}
                          onLost={handleLost}
                          onWon={handleWon}
                          isLast={idx === STATUSES.length - 1}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}

            {/* Customers column */}
            <div className="flex flex-col rounded-xl border-2 bg-emerald-50 border-emerald-200 w-[272px] shrink-0">
              <div className="px-3 py-2 rounded-t-lg flex items-center justify-between bg-emerald-100 text-emerald-800">
                <span className="text-sm font-semibold">Customers</span>
                <span className="text-xs font-medium opacity-70">{customers.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {customers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                    <Trophy className="h-8 w-8 mb-2" />
                    <p className="text-xs">No customers yet</p>
                  </div>
                ) : (
                  customers.map((opp) => (
                    <div
                      key={opp.id}
                      className="bg-white border border-emerald-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => handleCardClick(opp)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{opp.company?.name ?? "Unknown"}</p>
                          {opp.company?.category && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{opp.company.category}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleChurned(opp); }}
                          className="opacity-0 group-hover:opacity-100 transition-all inline-flex items-center p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Mark as Churned"
                        >
                          <TrendingDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {opp.won_at && (
                        <p className="text-xs text-emerald-600 mt-1">
                          Customer since {new Date(opp.won_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                      {(opp.company?.area || opp.company?.neighborhood || opp.company?.postal_code) && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {[opp.company.neighborhood, opp.company.area, opp.company.postal_code].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {transitioning && (
        <TransitionModal
          opportunity={transitioning}
          onComplete={handleTransitionComplete}
          onCancel={() => setTransitioning(null)}
        />
      )}

      <OpportunityPanel
        opportunity={panelOpp}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        onUpdated={handlePanelUpdate}
        onAdvance={(opp) => {
          setPanelOpen(false);
          setTransitioning(opp);
        }}
        onLost={handleLost}
        onWon={handleWon}
        onChurned={handleChurned}
      />
    </div>
  );
}
