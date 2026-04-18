"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { UserButton } from "@clerk/nextjs";
import {
  RefreshCw,
  Megaphone,
  Phone,
  Mail,
  Users,
  Send,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { NavTabs } from "@/components/NavTabs";
import type { Tables } from "@/lib/supabase/types";

type Campaign = Tables<"campaigns"> & { member_count: number };

const METHOD_LABELS: Record<string, string> = {
  phone: "Phone",
  email: "Email",
  in_person: "In person",
  mail: "Mail / leaflet",
  other: "Other",
};

function methodIcon(method: string) {
  switch (method) {
    case "phone":
      return <Phone className="h-3.5 w-3.5" />;
    case "email":
      return <Mail className="h-3.5 w-3.5" />;
    case "in_person":
      return <Users className="h-3.5 w-3.5" />;
    case "mail":
      return <Send className="h-3.5 w-3.5" />;
    default:
      return <MoreHorizontal className="h-3.5 w-3.5" />;
  }
}

export function CampaignsList() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("Failed to load campaigns");
      const data = (await res.json()) as { campaigns: Campaign[] };
      setCampaigns(data.campaigns);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (!confirm(`Delete campaign "${name}"? This cannot be undone.`)) return;
      setDeletingId(id);
      try {
        const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        toast.success("Campaign deleted");
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-3 sm:px-4 pt-2.5 sm:pt-3 pb-0">
        <div className="flex items-center justify-between gap-2 pb-2.5 sm:pb-3">
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate">
              Campaigns
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
              {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={fetchCampaigns}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <UserButton />
          </div>
        </div>
        <NavTabs />
      </header>

      <div className="p-3 sm:p-4">
        {loading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">
            Loading campaigns…
          </div>
        ) : campaigns.length === 0 ? (
          <div className="border border-dashed rounded-lg py-16 text-center">
            <Megaphone className="h-8 w-8 mx-auto text-muted-foreground/60 mb-3" />
            <p className="text-sm font-medium">No campaigns yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Select companies on the Leads tab and click{" "}
              <span className="font-medium">Create campaign</span> to start
              tracking your outreach.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="group relative border rounded-lg p-3 hover:border-primary/40 hover:shadow-sm transition-all bg-card"
              >
                <Link
                  href={`/campaigns/${c.id}`}
                  className="absolute inset-0"
                  aria-label={`Open ${c.name}`}
                />
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold truncate">{c.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {format(parseISO(c.campaign_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(c.id, c.name);
                    }}
                    disabled={deletingId === c.id}
                    className="relative z-10 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete campaign"
                    aria-label="Delete campaign"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted">
                    {methodIcon(c.method)}
                    {METHOD_LABELS[c.method] ?? c.method}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {c.member_count}{" "}
                    {c.member_count === 1 ? "company" : "companies"}
                  </span>
                </div>

                {c.notes && (
                  <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">
                    {c.notes}
                  </p>
                )}

                {c.created_by_user_name && (
                  <p className="text-[10px] text-muted-foreground/70 mt-2 truncate">
                    by {c.created_by_user_name}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
