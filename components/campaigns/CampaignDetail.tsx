"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  ChevronDown,
  ChevronUp,
  Navigation,
  Map as MapIcon,
} from "lucide-react";
import { NavTabs } from "@/components/NavTabs";
import type { Tables } from "@/lib/supabase/types";
import { useRouter } from "next/navigation";
import { OUTCOME_OPTIONS, outcomeLabel } from "@/lib/outcomes";

type Campaign = Tables<"campaigns">;

type ContactLite = {
  name: string | null;
  email: string | null;
  phone: string | null;
  notes?: string | null;
};

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
  | "latitude"
  | "longitude"
  | "location_link"
  | "prototype_url"
> & {
  contact: ContactLite | null;
};

type Member = {
  added_at: string;
  company: MemberCompany | null;
};

type NoteRow = {
  id: string;
  content: string;
  created_at: string;
  user_name: string | null;
};

type ExpandState = {
  outcomes: string[];
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  noteInput: string;
  notes: NoteRow[];
  loadingNotes: boolean;
  savingContact: boolean;
  savingOutcome: boolean;
  postingNote: boolean;
};

const OUTCOME_COLORS: Record<string, string> = {
  send_website: "bg-green-100 text-green-800 border-green-200",
  not_interested: "bg-red-100 text-red-800 border-red-200",
  interested: "bg-yellow-100 text-yellow-800 border-yellow-200",
  dead_number: "bg-gray-100 text-gray-600 border-gray-200",
  voicemail: "bg-orange-100 text-orange-800 border-orange-200",
  follow_up: "bg-orange-100 text-orange-800 border-orange-200",
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

function buildGoogleMapsUrl(companies: MemberCompany[]): string | null {
  const withCoords = companies.filter(
    (c) => typeof c.latitude === "number" && typeof c.longitude === "number"
  );
  if (withCoords.length === 0) {
    // Fallback: address-based
    const withAddr = companies.filter((c) => c.address || c.postal_code);
    if (withAddr.length === 0) return null;
    const encoded = withAddr
      .map((c) => encodeURIComponent((c.address ?? c.postal_code) as string))
      .join("/");
    return `https://www.google.com/maps/dir/${encoded}`;
  }
  if (withCoords.length < 2) {
    const c = withCoords[0];
    return `https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}`;
  }
  const [origin, ...rest] = withCoords;
  const destination = rest[rest.length - 1];
  const waypoints = rest.slice(0, -1);
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", `${origin.latitude},${origin.longitude}`);
  url.searchParams.set("destination", `${destination.latitude},${destination.longitude}`);
  if (waypoints.length) {
    url.searchParams.set(
      "waypoints",
      waypoints.map((w) => `${w.latitude},${w.longitude}`).join("|")
    );
  }
  url.searchParams.set("travelmode", "walking");
  return url.toString();
}

export function CampaignDetail({ id }: { id: string }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandStates, setExpandStates] = useState<Record<string, ExpandState>>({});
  const noteRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

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
    if (!confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) return;
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

  const handleOptimizeRoute = useCallback(async () => {
    const stops = members
      .map((m) => m.company)
      .filter(
        (c): c is MemberCompany & { latitude: number; longitude: number } =>
          !!c && typeof c.latitude === "number" && typeof c.longitude === "number"
      );
    if (stops.length < 2) {
      toast.error("Need at least 2 geocoded companies to optimize route");
      return;
    }
    setOptimizing(true);
    try {
      const res = await fetch("/api/route/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stops: stops.map((s) => ({ id: s.id, latitude: s.latitude, longitude: s.longitude })) }),
      });
      if (!res.ok) throw new Error("Optimization failed");
      const { orderedIds } = (await res.json()) as { orderedIds: string[] };
      // Reorder members based on optimized IDs
      const byId = new Map<string, Member>(
        members.flatMap((m) => (m.company?.id ? [[m.company.id, m]] : []))
      );
      const ordered = orderedIds
        .map((oid) => byId.get(oid))
        .filter((m): m is Member => !!m);
      const unordered = members.filter(
        (m) => !orderedIds.includes(m.company?.id ?? "")
      );
      setMembers([...ordered, ...unordered]);
      toast.success("Route optimised");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to optimise route");
    } finally {
      setOptimizing(false);
    }
  }, [members]);

  const toggleExpand = useCallback(
    async (companyId: string, company: MemberCompany) => {
      if (expandedId === companyId) {
        setExpandedId(null);
        return;
      }
      setExpandedId(companyId);
      if (!expandStates[companyId]) {
        const init: ExpandState = {
          outcomes: company.outcomes ?? [],
          contactName: company.contact?.name ?? "",
          contactEmail: company.contact?.email ?? "",
          contactPhone: company.contact?.phone ?? "",
          noteInput: "",
          notes: [],
          loadingNotes: true,
          savingContact: false,
          savingOutcome: false,
          postingNote: false,
        };
        setExpandStates((prev) => ({ ...prev, [companyId]: init }));
        try {
          const res = await fetch(`/api/companies/${companyId}/notes`);
          const data = (await res.json()) as { notes: NoteRow[] };
          setExpandStates((prev) => ({
            ...prev,
            [companyId]: { ...prev[companyId], notes: data.notes, loadingNotes: false },
          }));
        } catch {
          setExpandStates((prev) => ({
            ...prev,
            [companyId]: { ...prev[companyId], loadingNotes: false },
          }));
        }
      }
    },
    [expandedId, expandStates]
  );

  const patchState = useCallback(
    (companyId: string, patch: Partial<ExpandState>) => {
      setExpandStates((prev) => ({
        ...prev,
        [companyId]: { ...prev[companyId], ...patch },
      }));
    },
    []
  );

  const toggleOutcome = useCallback(
    async (companyId: string, value: string) => {
      const state = expandStates[companyId];
      if (!state) return;
      const isAdding = !state.outcomes.includes(value);
      const next = isAdding
        ? [...state.outcomes, value]
        : state.outcomes.filter((o) => o !== value);
      patchState(companyId, { outcomes: next, savingOutcome: true });
      try {
        const res = await fetch(`/api/companies/${companyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcomes: next, last_called_at: new Date().toISOString() }),
        });
        if (!res.ok) throw new Error("Failed");
        // Update local member list
        setMembers((prev) =>
          prev.map((m) =>
            m.company?.id === companyId
              ? { ...m, company: { ...m.company!, outcomes: next } }
              : m
          )
        );
      } catch {
        toast.error("Failed to save outcome");
        patchState(companyId, { outcomes: state.outcomes });
      } finally {
        patchState(companyId, { savingOutcome: false });
      }
    },
    [expandStates, patchState]
  );

  const saveContact = useCallback(
    async (companyId: string) => {
      const state = expandStates[companyId];
      if (!state) return;
      patchState(companyId, { savingContact: true });
      try {
        const payload = {
          name: state.contactName || null,
          email: state.contactEmail || null,
          phone: state.contactPhone || null,
        };
        const res = await fetch(`/api/companies/${companyId}/contact`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed");
        setMembers((prev) =>
          prev.map((m) =>
            m.company?.id === companyId
              ? { ...m, company: { ...m.company!, contact: payload } }
              : m
          )
        );
        toast.success("Contact saved");
      } catch {
        toast.error("Failed to save contact");
      } finally {
        patchState(companyId, { savingContact: false });
      }
    },
    [expandStates, patchState]
  );

  const postNote = useCallback(
    async (companyId: string) => {
      const state = expandStates[companyId];
      if (!state || !state.noteInput.trim() || state.postingNote) return;
      patchState(companyId, { postingNote: true });
      try {
        const res = await fetch(`/api/companies/${companyId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: state.noteInput.trim() }),
        });
        if (!res.ok) throw new Error("Failed");
        const note = (await res.json()) as NoteRow;
        patchState(companyId, {
          notes: [note, ...state.notes],
          noteInput: "",
          postingNote: false,
        });
        noteRefs.current[companyId]?.focus();
      } catch {
        toast.error("Failed to save note");
        patchState(companyId, { postingNote: false });
      }
    },
    [expandStates, patchState]
  );

  const validCompanies = members.map((m) => m.company).filter(Boolean) as MemberCompany[];
  const mapsUrl = buildGoogleMapsUrl(validCompanies);
  const geocodedCount = validCompanies.filter(
    (c) => typeof c.latitude === "number" && typeof c.longitude === "number"
  ).length;

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
            {/* Route buttons */}
            {validCompanies.length >= 2 && (
              <button
                onClick={handleOptimizeRoute}
                disabled={optimizing || geocodedCount < 2}
                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors disabled:opacity-60"
                title={geocodedCount < 2 ? "Need geocoded companies" : "Optimise walking route"}
              >
                {optimizing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Navigation className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Optimise Route</span>
              </button>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors"
                title="Open route in Google Maps"
              >
                <MapIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Google Maps</span>
              </a>
            )}
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
                      const isExpanded = expandedId === company.id;
                      const state = expandStates[company.id];
                      const outs = state?.outcomes ?? company.outcomes ?? [];

                      return (
                        <>
                          <tr
                            key={company.id}
                            className={`border-t hover:bg-muted/30 cursor-pointer ${isExpanded ? "bg-muted/20" : ""}`}
                            onClick={() => toggleExpand(company.id, company)}
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
                              {outs.length > 0 && (
                                <div className="flex flex-wrap gap-0.5 mt-0.5">
                                  {outs.slice(0, 3).map((o) => (
                                    <span
                                      key={o}
                                      className={`inline-block text-[10px] px-1 py-0 rounded border font-normal ${OUTCOME_COLORS[o] ?? ""}`}
                                    >
                                      {outcomeLabel(o)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 hidden sm:table-cell">
                              {company.contact?.name ? (
                                <div className="truncate max-w-[180px] text-xs">
                                  {company.contact.name}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 hidden md:table-cell">
                              {company.phone ? (
                                <a
                                  href={`tel:${company.phone}`}
                                  className="text-primary hover:underline text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {company.phone}
                                </a>
                              ) : company.email ? (
                                <a
                                  href={`mailto:${company.email}`}
                                  className="text-primary hover:underline text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {company.email}
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground text-xs">
                              <div className="flex items-start gap-1">
                                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                                <span className="truncate max-w-[240px]">
                                  {company.address ?? company.postal_code ?? "—"}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 hidden md:table-cell text-xs text-muted-foreground">
                              {company.neighborhood ?? company.area ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {company.prototype_url && (
                                  <a
                                    href={
                                      company.prototype_url.startsWith("http")
                                        ? company.prototype_url
                                        : `https://${company.prototype_url}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
                                    title="View prototype"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Prototype
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
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
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                                {company.location_link && (
                                  <a
                                    href={company.location_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-muted-foreground hover:text-foreground"
                                    title="Google Maps"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MapPin className="h-3.5 w-3.5" />
                                  </a>
                                )}
                                <div className="text-[10px] text-muted-foreground/60 hidden sm:block">
                                  {format(parseISO(added_at), "MMM d")}
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded panel */}
                          {isExpanded && state && (
                            <tr key={`${company.id}-expanded`} className="border-t bg-muted/10">
                              <td colSpan={6} className="px-4 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                                  {/* Outcomes */}
                                  <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                      Outcomes
                                      {state.savingOutcome && (
                                        <Loader2 className="inline h-3 w-3 animate-spin ml-1" />
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                      {OUTCOME_OPTIONS.map((opt) => {
                                        const Icon = opt.icon;
                                        const active = state.outcomes.includes(opt.value);
                                        return (
                                          <button
                                            key={opt.value}
                                            onClick={() => toggleOutcome(company.id, opt.value)}
                                            disabled={state.savingOutcome}
                                            className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors ${
                                              active
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-card hover:bg-accent"
                                            } disabled:opacity-50`}
                                          >
                                            <Icon className="h-3 w-3 shrink-0" />
                                            {opt.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Contact */}
                                  <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                      Contact
                                    </div>
                                    <div className="space-y-1.5">
                                      <input
                                        type="text"
                                        value={state.contactName}
                                        onChange={(e) =>
                                          patchState(company.id, { contactName: e.target.value })
                                        }
                                        placeholder="Name"
                                        className="w-full h-7 px-2 text-xs border rounded outline-none focus:ring-1 focus:ring-primary bg-background"
                                      />
                                      <input
                                        type="email"
                                        value={state.contactEmail}
                                        onChange={(e) =>
                                          patchState(company.id, { contactEmail: e.target.value })
                                        }
                                        placeholder="Email"
                                        className="w-full h-7 px-2 text-xs border rounded outline-none focus:ring-1 focus:ring-primary bg-background"
                                      />
                                      <input
                                        type="tel"
                                        value={state.contactPhone}
                                        onChange={(e) =>
                                          patchState(company.id, { contactPhone: e.target.value })
                                        }
                                        placeholder="Phone"
                                        className="w-full h-7 px-2 text-xs border rounded font-mono outline-none focus:ring-1 focus:ring-primary bg-background"
                                      />
                                      <button
                                        onClick={() => saveContact(company.id)}
                                        disabled={state.savingContact}
                                        className="w-full h-7 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                                      >
                                        {state.savingContact && (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        )}
                                        Save Contact
                                      </button>
                                    </div>
                                  </div>

                                  {/* Meeting Notes */}
                                  <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                      Meeting Notes
                                    </div>
                                    <textarea
                                      ref={(el) => { noteRefs.current[company.id] = el; }}
                                      value={state.noteInput}
                                      onChange={(e) =>
                                        patchState(company.id, { noteInput: e.target.value })
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                          e.preventDefault();
                                          postNote(company.id);
                                        }
                                      }}
                                      placeholder="Add a note… Enter to save"
                                      rows={2}
                                      disabled={state.postingNote}
                                      className="w-full px-2 py-1.5 text-xs border rounded outline-none focus:ring-1 focus:ring-primary bg-background resize-none disabled:opacity-50"
                                    />
                                    <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                                      {state.loadingNotes ? (
                                        <p className="text-xs text-muted-foreground">Loading…</p>
                                      ) : state.notes.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic">No notes yet.</p>
                                      ) : (
                                        state.notes.map((n) => (
                                          <div
                                            key={n.id}
                                            className="text-xs bg-muted/40 rounded px-2 py-1.5"
                                          >
                                            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground mb-0.5">
                                              <span className="font-medium">
                                                {n.user_name ?? "Someone"}
                                              </span>
                                              <span>
                                                {new Date(n.created_at).toLocaleString()}
                                              </span>
                                            </div>
                                            <p className="whitespace-pre-wrap">{n.content}</p>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
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
