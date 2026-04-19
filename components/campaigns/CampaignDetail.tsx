"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
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
  Pencil,
  X,
  Plus,
  Search,
} from "lucide-react";
import { NavTabs } from "@/components/NavTabs";
import type { Tables } from "@/lib/supabase/types";
import { useRouter } from "next/navigation";
import { OUTCOME_OPTIONS, outcomeLabel, FOLLOW_UP_METHODS } from "@/lib/outcomes";
import { nextOpenLabel, allHoursFormatted } from "@/lib/hours";
import type { Contact } from "@/lib/use-companies";

const CampaignMap = dynamic(
  () => import("./CampaignMap").then((m) => ({ default: m.CampaignMap })),
  { ssr: false }
);

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
  | "latitude"
  | "longitude"
  | "location_link"
  | "prototype_url"
  | "working_hours"
  | "callback_at"
  | "calendar_event_id"
  | "follow_up_method"
> & {
  contact: { name: string | null; email: string | null; phone: string | null; notes?: string | null } | null;
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
  followUpMethod: string;
  callbackDate: Date | undefined;
  callbackTime: string;
  schedulingCallback: boolean;
  cancellingCallback: boolean;
  editingNoteId: string | null;
  editingNoteContent: string;
  contacts: Contact[];
  loadingContacts: boolean;
  showAddContact: boolean;
  editingContactId: string | null;
  contactFormName: string;
  contactFormEmail: string;
  contactFormPhone: string;
  contactFormNotes: string;
  contactFormRole: string;
  noteInput: string;
  notes: NoteRow[];
  loadingNotes: boolean;
  savingOutcome: boolean;
  postingNote: boolean;
  prototypeUrl: string;
  savingPrototype: boolean;
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

  // Add business search
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; address: string | null; postal_code: string | null; area: string | null }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  const searchCompanies = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/companies/search?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { companies: { id: string; name: string; address: string | null; postal_code: string | null; area: string | null }[] };
      const existingIds = new Set(members.map((m) => m.company?.id));
      setSearchResults((data.companies ?? []).filter((c) => !existingIds.has(c.id)));
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [members]);

  const addMember = useCallback(async (companyId: string) => {
    setAddingId(companyId);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (!res.ok) throw new Error("Failed to add");
      await fetchDetail();
      setSearchQuery("");
      setSearchResults([]);
      setShowAddSearch(false);
      toast.success("Business added to campaign");
    } catch {
      toast.error("Failed to add business");
    } finally {
      setAddingId(null);
    }
  }, [id, fetchDetail]);

  const removeMember = useCallback(async (companyId: string, companyName: string) => {
    if (!confirm(`Remove "${companyName}" from this campaign?`)) return;
    setRemovingId(companyId);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeMember: companyId }),
      });
      if (!res.ok) throw new Error("Failed to remove");
      setMembers((prev) => prev.filter((m) => m.company?.id !== companyId));
      toast.success("Removed from campaign");
    } catch {
      toast.error("Failed to remove");
    } finally {
      setRemovingId(null);
    }
  }, [id]);

  useEffect(() => {
    const t = setTimeout(() => searchCompanies(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchCompanies]);

  useEffect(() => {
    if (showAddSearch) setTimeout(() => searchRef.current?.focus(), 50);
  }, [showAddSearch]);

  const patchState = useCallback(
    (companyId: string, patch: Partial<ExpandState>) => {
      setExpandStates((prev) => ({
        ...prev,
        [companyId]: { ...prev[companyId], ...patch },
      }));
    },
    []
  );

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
          followUpMethod: company.follow_up_method ?? "",
          callbackDate: company.callback_at ? new Date(company.callback_at) : undefined,
          callbackTime: company.callback_at
            ? `${String(new Date(company.callback_at).getHours()).padStart(2, "0")}:${String(new Date(company.callback_at).getMinutes()).padStart(2, "0")}`
            : "10:00",
          schedulingCallback: false,
          cancellingCallback: false,
          editingNoteId: null,
          editingNoteContent: "",
          contacts: company.contact ? [company.contact as Contact] : [],
          loadingContacts: true,
          showAddContact: false,
          editingContactId: null,
          contactFormName: "",
          contactFormEmail: "",
          contactFormPhone: "",
          contactFormNotes: "",
          contactFormRole: "",
          noteInput: "",
          notes: [],
          loadingNotes: true,
          savingOutcome: false,
          postingNote: false,
          prototypeUrl: company.prototype_url ?? "",
          savingPrototype: false,
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
        fetch(`/api/companies/${companyId}/contact`)
          .then(r => r.json())
          .then((d: { contacts: Contact[] }) => {
            setExpandStates((prev) => ({
              ...prev,
              [companyId]: { ...prev[companyId], contacts: d.contacts, loadingContacts: false },
            }));
          })
          .catch(() => setExpandStates((prev) => ({
            ...prev,
            [companyId]: { ...prev[companyId], loadingContacts: false },
          })));
      }
    },
    [expandedId, expandStates]
  );

  const savePrototypeUrl = useCallback(async (companyId: string) => {
    const state = expandStates[companyId];
    if (!state) return;
    patchState(companyId, { savingPrototype: true });
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prototype_url: state.prototypeUrl || null }),
      });
      if (!res.ok) throw new Error("Failed");
      setMembers((prev) =>
        prev.map((m) =>
          m.company?.id === companyId
            ? { ...m, company: { ...m.company!, prototype_url: state.prototypeUrl || null } }
            : m
        )
      );
      toast.success("Prototype URL saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      patchState(companyId, { savingPrototype: false });
    }
  }, [expandStates, patchState]);

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

  const addContact = useCallback(
    async (companyId: string) => {
      const state = expandStates[companyId];
      if (!state) return;
      const payload = { name: state.contactFormName || null, email: state.contactFormEmail || null, phone: state.contactFormPhone || null, notes: state.contactFormNotes || null, role: state.contactFormRole || null };
      try {
        const res = await fetch(`/api/companies/${companyId}/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error("Failed");
        const saved = (await res.json()) as Contact;
        patchState(companyId, { contacts: [...state.contacts, saved], showAddContact: false, contactFormName: "", contactFormEmail: "", contactFormPhone: "", contactFormNotes: "", contactFormRole: "" });
        toast.success("Contact added");
      } catch { toast.error("Failed to add contact"); }
    },
    [expandStates, patchState]
  );

  const updateContact = useCallback(
    async (companyId: string) => {
      const state = expandStates[companyId];
      if (!state || !state.editingContactId) return;
      const payload = { name: state.contactFormName || null, email: state.contactFormEmail || null, phone: state.contactFormPhone || null, notes: state.contactFormNotes || null, role: state.contactFormRole || null };
      try {
        const res = await fetch(`/api/companies/${companyId}/contact?id=${state.editingContactId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error("Failed");
        const saved = (await res.json()) as Contact;
        patchState(companyId, { contacts: state.contacts.map(c => c.id === state.editingContactId ? saved : c), showAddContact: false, editingContactId: null });
        toast.success("Contact saved");
      } catch { toast.error("Failed to save contact"); }
    },
    [expandStates, patchState]
  );

  const deleteContact = useCallback(
    async (companyId: string, contactId: string) => {
      const state = expandStates[companyId];
      if (!state) return;
      try {
        const res = await fetch(`/api/companies/${companyId}/contact?id=${contactId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed");
        patchState(companyId, { contacts: state.contacts.filter(c => c.id !== contactId) });
      } catch { toast.error("Failed to delete contact"); }
    },
    [expandStates, patchState]
  );

  const updateNote = useCallback(
    async (companyId: string) => {
      const state = expandStates[companyId];
      if (!state || !state.editingNoteId || !state.editingNoteContent.trim()) return;
      try {
        const res = await fetch(`/api/companies/${companyId}/notes`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId: state.editingNoteId, content: state.editingNoteContent.trim() }) });
        if (!res.ok) throw new Error("Failed");
        const updated = (await res.json()) as NoteRow;
        patchState(companyId, { notes: state.notes.map(n => n.id === state.editingNoteId ? updated : n), editingNoteId: null, editingNoteContent: "" });
      } catch { toast.error("Failed to save note"); }
    },
    [expandStates, patchState]
  );

  const scheduleFollowUp = useCallback(
    async (companyId: string, company: MemberCompany) => {
      const state = expandStates[companyId];
      if (!state || !state.callbackDate) return;
      patchState(companyId, { schedulingCallback: true });
      try {
        const [hh, mm] = state.callbackTime.split(":").map(Number);
        const dt = new Date(state.callbackDate);
        dt.setHours(hh, mm, 0, 0);
        const existingEventId = company.calendar_event_id;
        let location: string | null = null;
        const primaryContact = state.contacts[0] ?? null;
        if (state.followUpMethod === "in_person") location = company.address ?? null;
        else if (state.followUpMethod === "email") location = primaryContact?.email || company.email || null;
        else if (state.followUpMethod === "phone") location = primaryContact?.phone || company.phone || null;

        const basePayload = {
          companyName: company.name, phone: company.phone, address: company.address, location,
          method: state.followUpMethod || null, startTime: dt.toISOString(),
          notes: state.notes.map(n => ({ content: n.content, created_at: n.created_at, user_name: n.user_name })),
          contact: primaryContact ? { name: primaryContact.name, email: primaryContact.email, phone: primaryContact.phone } : null,
        };

        let calRes = existingEventId
          ? await fetch("/api/calendar/event", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ eventId: existingEventId, ...basePayload }),
            })
          : null;

        // PATCH failed (event deleted from Google Calendar) — fall back to creating a new one
        if (!calRes?.ok) {
          calRes = await fetch("/api/calendar/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(basePayload),
          });
        }

        let calendarEventId: string | null = null;
        if (calRes.ok) { const calData = (await calRes.json()) as { eventId?: string }; calendarEventId = calData.eventId ?? null; }

        await fetch(`/api/companies/${companyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_at: dt.toISOString(), calendar_event_id: calendarEventId }) });

        if (!state.outcomes.includes("follow_up")) {
          const newOutcomes = [...state.outcomes, "follow_up"];
          await fetch(`/api/companies/${companyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcomes: newOutcomes }) });
          patchState(companyId, { outcomes: newOutcomes });
          setMembers(prev => prev.map(m => m.company?.id === companyId ? { ...m, company: { ...m.company!, outcomes: newOutcomes, callback_at: dt.toISOString(), calendar_event_id: calendarEventId } } : m));
        } else {
          setMembers(prev => prev.map(m => m.company?.id === companyId ? { ...m, company: { ...m.company!, callback_at: dt.toISOString(), calendar_event_id: calendarEventId } } : m));
        }
        toast.success(calendarEventId ? (existingEventId ? "Follow up updated + calendar invite sent" : "Follow up scheduled + calendar invite sent") : "Follow up saved");
      } catch { toast.error("Failed to schedule follow up"); }
      finally { patchState(companyId, { schedulingCallback: false }); }
    },
    [expandStates, patchState, setMembers]
  );

  const cancelFollowUp = useCallback(
    async (companyId: string, company: MemberCompany) => {
      const state = expandStates[companyId];
      if (!state) return;
      patchState(companyId, { cancellingCallback: true });
      try {
        if (company.calendar_event_id) {
          await fetch(`/api/calendar/event?eventId=${encodeURIComponent(company.calendar_event_id)}`, { method: "DELETE" });
        }
        await fetch(`/api/companies/${companyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_at: null, calendar_event_id: null }) });
        const newOutcomes = state.outcomes.filter(o => o !== "follow_up");
        if (newOutcomes.length !== state.outcomes.length) {
          await fetch(`/api/companies/${companyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcomes: newOutcomes }) });
          patchState(companyId, { outcomes: newOutcomes, callbackDate: undefined, callbackTime: "10:00" });
          setMembers(prev => prev.map(m => m.company?.id === companyId ? { ...m, company: { ...m.company!, outcomes: newOutcomes, callback_at: null, calendar_event_id: null } } : m));
        } else {
          patchState(companyId, { callbackDate: undefined, callbackTime: "10:00" });
          setMembers(prev => prev.map(m => m.company?.id === companyId ? { ...m, company: { ...m.company!, callback_at: null, calendar_event_id: null } } : m));
        }
        toast.success("Follow up cancelled");
      } catch { toast.error("Failed to cancel follow up"); }
      finally { patchState(companyId, { cancellingCallback: false }); }
    },
    [expandStates, patchState, setMembers]
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
            <button
              onClick={() => setShowAddSearch((v) => !v)}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add business</span>
            </button>
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

            {/* Add business search panel */}
            {showAddSearch && (
              <div className="border rounded-lg p-3 bg-card space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search by name, postcode or address…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-8 h-9 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {searchLoading && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                  </div>
                )}
                {!searchLoading && searchResults.length > 0 && (
                  <div className="border rounded-md overflow-hidden divide-y text-sm">
                    {searchResults.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/40">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {[c.address, c.postal_code, c.area].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <button
                          onClick={() => addMember(c.id)}
                          disabled={addingId === c.id}
                          className="ml-3 shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-60"
                        >
                          {addingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1">No matching businesses found.</p>
                )}
              </div>
            )}

            {members.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                No companies in this campaign. Use &ldquo;Add business&rdquo; above to add one.
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
                      <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">Next Open</th>
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
                              {/* Mobile-only summary row */}
                              <div className="sm:hidden mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                                {company.contact?.name && (
                                  <span className="truncate max-w-[160px]">{company.contact.name}</span>
                                )}
                                {(() => {
                                  const label = nextOpenLabel(company.working_hours);
                                  if (!label) return null;
                                  return (
                                    <span className={label === "Open Now" ? "text-green-600 font-medium" : ""}>
                                      {label}
                                    </span>
                                  );
                                })()}
                                {company.prototype_url && (
                                  <a
                                    href={company.prototype_url.startsWith("http") ? company.prototype_url : `https://${company.prototype_url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-violet-600 hover:underline inline-flex items-center gap-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Prototype <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                )}
                              </div>
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
                            <td className="px-3 py-2 hidden lg:table-cell text-xs">
                              {(() => {
                                const label = nextOpenLabel(company.working_hours);
                                if (!label) return <span className="text-muted-foreground">—</span>;
                                return (
                                  <span className={label === "Open Now" ? "text-green-600 font-medium" : "text-muted-foreground"}>
                                    {label}
                                  </span>
                                );
                              })()}
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
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeMember(company.id, company.name ?? "this business"); }}
                                  disabled={removingId === company.id}
                                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-60"
                                  title="Remove from campaign"
                                >
                                  {removingId === company.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                                </button>
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
                              <td colSpan={7} className="px-4 py-4">
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

                                    {/* Prototype URL */}
                                    <div className="mt-4 pt-3 border-t">
                                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Prototype URL</div>
                                      <div className="flex gap-1">
                                        <input
                                          type="url"
                                          value={state.prototypeUrl}
                                          onChange={(e) => patchState(company.id, { prototypeUrl: e.target.value })}
                                          onKeyDown={(e) => { if (e.key === "Enter") savePrototypeUrl(company.id); }}
                                          placeholder="https://…"
                                          className="flex-1 h-7 px-2 text-xs border rounded outline-none focus:ring-1 focus:ring-primary bg-background font-mono"
                                        />
                                        <button
                                          onClick={() => savePrototypeUrl(company.id)}
                                          disabled={state.savingPrototype}
                                          className="h-7 px-2.5 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-60 shrink-0"
                                        >
                                          {state.savingPrototype ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                        </button>
                                      </div>
                                      {state.prototypeUrl && (
                                        <a
                                          href={state.prototypeUrl.startsWith("http") ? state.prototypeUrl : `https://${state.prototypeUrl}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-violet-600 hover:underline"
                                        >
                                          Open <ExternalLink className="h-2.5 w-2.5" />
                                        </a>
                                      )}
                                    </div>
                                  </div>

                                  {/* Contact */}
                                  <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Contacts</div>
                                    <div className="flex flex-wrap gap-1.5 items-center mb-2">
                                      {state.contacts.map((c) => (
                                        <div key={c.id} className="group flex items-center gap-1 bg-muted rounded-full pl-2.5 pr-1 py-0.5">
                                          <span className="text-xs">{c.name || c.email || c.phone || "—"}{c.role ? <span className="ml-1 text-[10px] text-muted-foreground">({c.role})</span> : null}</span>
                                          <button onClick={() => patchState(company.id, { editingContactId: c.id, contactFormName: c.name ?? "", contactFormEmail: c.email ?? "", contactFormPhone: c.phone ?? "", contactFormNotes: c.notes ?? "", contactFormRole: c.role ?? "", showAddContact: true })} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"><Pencil className="h-2.5 w-2.5" /></button>
                                          <button onClick={() => deleteContact(company.id, c.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"><X className="h-2.5 w-2.5" /></button>
                                        </div>
                                      ))}
                                      {!state.showAddContact && (
                                        <button onClick={() => patchState(company.id, { showAddContact: true, editingContactId: null, contactFormName: "", contactFormEmail: "", contactFormPhone: "", contactFormNotes: "", contactFormRole: "" })} className="text-[11px] text-primary hover:underline">+ Add</button>
                                      )}
                                    </div>
                                    {state.showAddContact && (
                                      <div className="space-y-1.5">
                                        <input type="text" value={state.contactFormName} onChange={e => patchState(company.id, { contactFormName: e.target.value })} placeholder="Name" className="w-full h-7 px-2 text-xs border rounded outline-none focus:ring-1 focus:ring-primary bg-background" />
                                        <input type="email" value={state.contactFormEmail} onChange={e => patchState(company.id, { contactFormEmail: e.target.value })} placeholder="Email" className="w-full h-7 px-2 text-xs border rounded outline-none focus:ring-1 focus:ring-primary bg-background" />
                                        <input type="tel" value={state.contactFormPhone} onChange={e => patchState(company.id, { contactFormPhone: e.target.value })} placeholder="Phone" className="w-full h-7 px-2 text-xs border rounded font-mono outline-none focus:ring-1 focus:ring-primary bg-background" />
                                        <div className="flex gap-1">
                                          {["Manager", "Owner", "Server", "Unknown"].map((r) => (
                                            <button key={r} type="button" onClick={() => patchState(company.id, { contactFormRole: state.contactFormRole === r ? "" : r })} className={`flex-1 h-6 text-[10px] rounded border transition-colors ${state.contactFormRole === r ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}>{r}</button>
                                          ))}
                                        </div>
                                        <div className="flex gap-1">
                                          <button onClick={() => state.editingContactId ? updateContact(company.id) : addContact(company.id)} className="flex-1 h-7 text-xs bg-primary text-primary-foreground rounded hover:opacity-90">
                                            {state.editingContactId ? "Save" : "Add contact"}
                                          </button>
                                          <button onClick={() => patchState(company.id, { showAddContact: false, editingContactId: null })} className="h-7 px-2 text-xs border rounded hover:bg-accent">Cancel</button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Follow up scheduler when follow_up outcome is active */}
                                    {state.outcomes.includes("follow_up") && (
                                      <div className="mt-3 pt-3 border-t space-y-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Schedule Follow Up</div>
                                        <div className="flex gap-1">
                                          {FOLLOW_UP_METHODS.map((m) => (
                                            <button key={m.value} type="button" onClick={() => patchState(company.id, { followUpMethod: state.followUpMethod === m.value ? "" : m.value })} className={`flex-1 px-1.5 py-1 text-[11px] rounded border transition-colors ${state.followUpMethod === m.value ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}>{m.label}</button>
                                          ))}
                                        </div>
                                        <div className="flex gap-2">
                                          <input type="date" value={state.callbackDate ? state.callbackDate.toISOString().split("T")[0] : ""} onChange={e => patchState(company.id, { callbackDate: e.target.value ? new Date(e.target.value + "T00:00") : undefined })} min={new Date().toISOString().split("T")[0]} className="flex-1 h-7 px-2 text-xs border rounded bg-background" />
                                          <input type="time" value={state.callbackTime} onChange={e => patchState(company.id, { callbackTime: e.target.value })} className="w-24 h-7 px-2 text-xs border rounded bg-background" />
                                        </div>
                                        <button onClick={() => scheduleFollowUp(company.id, company)} disabled={!state.callbackDate || state.schedulingCallback} className="w-full h-7 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-1">
                                          {state.schedulingCallback && <Loader2 className="h-3 w-3 animate-spin" />}
                                          {company.callback_at ? "Update follow up" : "Schedule + invite"}
                                        </button>
                                        {company.callback_at && (
                                          <div className="space-y-1">
                                            <p className="text-[10px] text-muted-foreground">Current: {new Date(company.callback_at).toLocaleString()}</p>
                                            <button onClick={() => cancelFollowUp(company.id, company)} disabled={state.cancellingCallback || state.schedulingCallback} className="w-full h-7 text-xs border border-destructive/50 text-destructive rounded hover:bg-destructive/10 disabled:opacity-50 inline-flex items-center justify-center gap-1">
                                              {state.cancellingCallback && <Loader2 className="h-3 w-3 animate-spin" />}
                                              Cancel follow up
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
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
                                          <div key={n.id} className="text-xs bg-muted/40 rounded px-2 py-1.5 group">
                                            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground mb-0.5">
                                              <span className="font-medium">{n.user_name ?? "Someone"}</span>
                                              <div className="flex items-center gap-1.5">
                                                <span>{new Date(n.created_at).toLocaleString()}</span>
                                                <button onClick={() => patchState(company.id, { editingNoteId: n.id, editingNoteContent: n.content })} className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground" title="Edit"><Pencil className="h-2.5 w-2.5" /></button>
                                              </div>
                                            </div>
                                            {state.editingNoteId === n.id ? (
                                              <div>
                                                <textarea value={state.editingNoteContent} onChange={e => patchState(company.id, { editingNoteContent: e.target.value })} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); updateNote(company.id); } if (e.key === "Escape") patchState(company.id, { editingNoteId: null }); }} rows={2} autoFocus className="w-full text-xs bg-background border rounded px-2 py-1 resize-none focus:ring-1 focus:ring-primary outline-none mt-1" />
                                                <div className="flex gap-1 mt-1">
                                                  <button onClick={() => updateNote(company.id)} className="text-[10px] bg-primary text-primary-foreground rounded px-2 py-0.5">Save</button>
                                                  <button onClick={() => patchState(company.id, { editingNoteId: null })} className="text-[10px] border rounded px-2 py-0.5 hover:bg-accent">Cancel</button>
                                                </div>
                                              </div>
                                            ) : (
                                              <p className="whitespace-pre-wrap">{n.content}</p>
                                            )}
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Opening hours */}
                                {(() => {
                                  const weekHours = allHoursFormatted(company.working_hours);
                                  if (!weekHours) return null;
                                  return (
                                    <div className="mt-4 pt-4 border-t">
                                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Opening Hours</div>
                                      <table className="text-[11px] w-full max-w-xs">
                                        <tbody>
                                          {weekHours.map(({ day, hours, isToday }) => (
                                            <tr key={day} className={isToday ? "font-medium" : "text-muted-foreground"}>
                                              <td className="pr-3 w-10 opacity-80">{day}</td>
                                              <td>{hours}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  );
                                })()}
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

            {members.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Map</h2>
                <CampaignMap
                  members={validCompanies}
                  orderedIds={members.map(m => m.company?.id).filter(Boolean) as string[]}
                />
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
