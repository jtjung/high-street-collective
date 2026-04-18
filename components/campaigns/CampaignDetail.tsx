"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { UserButton } from "@clerk/nextjs";
import {
  ArrowLeft,
  Phone,
  Mail,
  Users,
  Send,
  MoreHorizontal,
  ExternalLink,
  MapPin,
  Star,
  CheckCircle2,
  Trash2,
  Loader2,
} from "lucide-react";
import { NavTabs } from "@/components/NavTabs";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/lib/supabase/types";
import { useRouter } from "next/navigation";

type Campaign = Tables<"campaigns">;

type MemberCompany = Pick<
  Tables<"companies">,
  | "id"
  | "name"
  | "subtypes"
  | "phone"
  | "email"
  | "address"
  | "postal_code"
  | "area"
  | "neighborhood"
  | "website"
  | "rating"
  | "reviews"
  | "verified"
  | "outcomes"
  | "contact_name"
  | "contact_address"
  | "contact_method"
>;

type Member = {
  added_at: string;
  company: MemberCompany | null;
};

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

export function CampaignDetail({ id }: { id: string }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to load");
      }
      const data = (await res.json()) as {
        campaign: Campaign;
        members: Member[];
      };
      setCampaign(data.campaign);
      setMembers(data.members);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleDelete = useCallback(async () => {
    if (!campaign) return;
    if (
      !confirm(
        `Delete campaign "${campaign.name}"? This cannot be undone.`
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast.success("Campaign deleted");
      router.push("/campaigns");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }, [campaign, id, router]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-3 sm:px-4 pt-2.5 sm:pt-3 pb-0">
        <div className="flex items-center justify-between gap-2 pb-2.5 sm:pb-3">
          <div className="min-w-0 flex items-center gap-2">
            <Link
              href="/campaigns"
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Back to campaigns"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate">
                {campaign?.name ?? "Campaign"}
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                {members.length} {members.length === 1 ? "company" : "companies"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {campaign && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium border rounded-md hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-60"
                title="Delete campaign"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
            <UserButton />
          </div>
        </div>
        <NavTabs />
      </header>

      <div className="p-3 sm:p-4 space-y-4">
        {loading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">
            Loading campaign…
          </div>
        ) : campaign ? (
          <>
            <div className="border rounded-lg p-3 sm:p-4 bg-card grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Date
                </div>
                <div className="mt-0.5 font-medium">
                  {format(parseISO(campaign.campaign_date), "MMM d, yyyy")}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Method
                </div>
                <div className="mt-0.5 inline-flex items-center gap-1">
                  {methodIcon(campaign.method)}
                  <span className="font-medium">
                    {METHOD_LABELS[campaign.method] ?? campaign.method}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Created by
                </div>
                <div className="mt-0.5 font-medium truncate">
                  {campaign.created_by_user_name ??
                    campaign.created_by_user_email ??
                    "—"}
                </div>
              </div>
              {campaign.notes && (
                <div className="sm:col-span-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Notes
                  </div>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">
                    {campaign.notes}
                  </p>
                </div>
              )}
            </div>

            {members.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                No companies in this campaign.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">
                        Contact
                      </th>
                      <th className="text-left px-3 py-2 font-medium hidden md:table-cell">
                        Phone
                      </th>
                      <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">
                        Address
                      </th>
                      <th className="text-left px-3 py-2 font-medium hidden md:table-cell">
                        Area
                      </th>
                      <th className="text-right px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(({ company, added_at }) => {
                      if (!company) return null;
                      return (
                        <tr
                          key={company.id}
                          className="border-t hover:bg-muted/30"
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium truncate max-w-[220px]">
                                {company.name}
                              </span>
                              {company.verified && (
                                <CheckCircle2 className="h-3 w-3 text-blue-500 shrink-0" />
                              )}
                            </div>
                            {company.subtypes && (
                              <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                                {company.subtypes}
                              </div>
                            )}
                            {company.rating != null && (
                              <div className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground mt-0.5">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                {company.rating.toFixed(1)}
                                {company.reviews != null && (
                                  <span>({company.reviews})</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 hidden sm:table-cell">
                            {company.contact_name ? (
                              <div>
                                <div className="truncate max-w-[180px]">
                                  {company.contact_name}
                                </div>
                                {company.contact_method && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] mt-0.5"
                                  >
                                    {METHOD_LABELS[company.contact_method] ??
                                      company.contact_method}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 hidden md:table-cell">
                            {company.phone ? (
                              <a
                                href={`tel:${company.phone}`}
                                className="text-primary hover:underline"
                              >
                                {company.phone}
                              </a>
                            ) : company.email ? (
                              <a
                                href={`mailto:${company.email}`}
                                className="text-primary hover:underline text-xs"
                              >
                                {company.email}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground text-xs">
                            <div className="flex items-start gap-1">
                              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                              <span className="truncate max-w-[240px]">
                                {company.address ??
                                  company.postal_code ??
                                  "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 hidden md:table-cell text-xs text-muted-foreground">
                            {company.neighborhood ?? company.area ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {company.website && (
                              <a
                                href={
                                  company.website.startsWith("http")
                                    ? company.website
                                    : `https://${company.website}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-muted-foreground hover:text-foreground"
                                title={company.website}
                                aria-label="Open website"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <div className="text-[10px] text-muted-foreground/60 mt-0.5 hidden sm:block">
                              {format(parseISO(added_at), "MMM d")}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground py-12 text-center">
            Campaign not found.
          </div>
        )}
      </div>
    </div>
  );
}
