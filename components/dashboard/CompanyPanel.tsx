"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  Clock,
  ExternalLink,
  Globe,
  Keyboard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Star,
} from "lucide-react";
import { openStatusLabel, allHoursFormatted } from "@/lib/hours";
import { toast } from "sonner";
import {
  OUTCOME_OPTIONS,
  NOT_INTERESTED_REASONS,
  FOLLOW_UP_METHODS,
  type FollowUpMethod,
} from "@/lib/outcomes";
import { Input } from "@/components/ui/input";
import type { Company, Contact } from "@/lib/use-companies";
import type { Tables } from "@/lib/supabase/types";

type Note = Tables<"company_notes">;

const TIMES = Array.from({ length: (18 - 9) * 4 }, (_, i) => {
  const h = 9 + Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

// Platform detection for correct modifier label
const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center gap-0.5 rounded border bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground font-mono shadow-sm">
      {children}
    </kbd>
  );
}

interface CompanyPanelProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (id: string, patch: Partial<Company>) => void;
}

export function CompanyPanel({
  company,
  open,
  onOpenChange,
  onUpdated,
}: CompanyPanelProps) {
  const { user } = useUser();
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [postingNote, setPostingNote] = useState(false);

  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [savingOutcomes, setSavingOutcomes] = useState(false);
  const [notInterestedReason, setNotInterestedReason] = useState<string | null>(
    null
  );
  const [contact, setContact] = useState<Contact | null>(null);
  const [contactName, setContactName] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");
  const [contactPhone, setContactPhone] = useState<string>("");
  const [contactNotes, setContactNotes] = useState<string>("");

  const [followUpMethod, setFollowUpMethod] = useState<FollowUpMethod | "">("");
  const [callbackDate, setCallbackDate] = useState<Date | undefined>();
  const [callbackTime, setCallbackTime] = useState<string>("10:00");
  const [schedulingCallback, setSchedulingCallback] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset on company change
  useEffect(() => {
    if (!company) return;
    setOutcomes(company.outcomes ?? []);
    setContact(company.contact ?? null);
    setContactName(company.contact?.name ?? "");
    setContactEmail(company.contact?.email ?? "");
    setContactPhone(company.contact?.phone ?? "");
    setContactNotes(company.contact?.notes ?? "");
    setNotInterestedReason(company.not_interested_reason ?? null);
    setFollowUpMethod((company.follow_up_method as FollowUpMethod) ?? "");
    setNoteInput("");
    if (company.callback_at) {
      const d = new Date(company.callback_at);
      setCallbackDate(d);
      setCallbackTime(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      );
    } else {
      setCallbackDate(undefined);
      setCallbackTime("10:00");
    }
  }, [company]);

  // Fetch notes
  const fetchNotes = useCallback(async (companyId: string) => {
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/notes`);
      const data = (await res.json()) as { notes: Note[] };
      setNotes(data.notes);
    } catch {
      toast.error("Failed to load meeting notes");
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  useEffect(() => {
    if (company && open) {
      fetchNotes(company.id);
    }
  }, [company, open, fetchNotes]);

  const postNote = async () => {
    if (!company || !noteInput.trim() || postingNote) return;
    setPostingNote(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteInput.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const note = (await res.json()) as Note;
      setNotes((prev) => [note, ...prev]);
      setNoteInput("");
      onUpdated(company.id, { last_reached_out: note.created_at });
    } catch {
      toast.error("Failed to save note");
    } finally {
      setPostingNote(false);
      textareaRef.current?.focus();
    }
  };

  const [opportunityLink, setOpportunityLink] = useState<string | null>(null);

  const toggleOutcome = useCallback(
    async (value: string) => {
      if (!company) return;
      const isAdding = !outcomes.includes(value);
      const next = isAdding
        ? [...outcomes, value]
        : outcomes.filter((o) => o !== value);
      setOutcomes(next);
      setSavingOutcomes(true);

      // Clear reason if not_interested is being removed
      const patch: {
        outcomes: string[];
        last_called_at: string;
        not_interested_reason?: string | null;
      } = {
        outcomes: next,
        last_called_at: new Date().toISOString(),
      };
      if (!isAdding && value === "not_interested") {
        patch.not_interested_reason = null;
        setNotInterestedReason(null);
      }

      try {
        const res = await fetch(`/api/companies/${company.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error("Failed");
        onUpdated(company.id, patch);

        // Auto-create opportunity when send_website is toggled on
        if (isAdding && value === "send_website") {
          fetch("/api/opportunities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ company_id: company.id }),
          }).then(() => {
            setOpportunityLink("/opportunities");
            toast.success("Lead converted to opportunity", {
              action: { label: "View", onClick: () => window.open("/opportunities", "_blank") },
            });
          }).catch(() => {});
        }
      } catch {
        toast.error("Failed to save outcome");
        setOutcomes(outcomes);
      } finally {
        setSavingOutcomes(false);
      }
    },
    [company, outcomes, onUpdated]
  );

  const saveContactField = useCallback(
    async (next: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      notes?: string | null;
    }) => {
      if (!company) return;
      const payload = {
        name: contact?.name ?? null,
        email: contact?.email ?? null,
        phone: contact?.phone ?? null,
        notes: contact?.notes ?? null,
        ...next,
      };
      try {
        const res = await fetch(`/api/companies/${company.id}/contact`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed");
        const saved = (await res.json()) as Contact;
        setContact(saved);
        onUpdated(company.id, { contact: saved });
      } catch {
        toast.error("Failed to save contact");
      }
    },
    [company, contact, onUpdated]
  );

  const updateReason = async (value: string) => {
    if (!company) return;
    setNotInterestedReason(value);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ not_interested_reason: value }),
      });
      if (!res.ok) throw new Error("Failed");
      onUpdated(company.id, { not_interested_reason: value });
    } catch {
      toast.error("Failed to save reason");
    }
  };

  const updateFollowUpMethod = async (value: FollowUpMethod | "") => {
    if (!company) return;
    setFollowUpMethod(value);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_method: value || null }),
      });
      if (!res.ok) throw new Error("Failed");
      onUpdated(company.id, { follow_up_method: value || null });
    } catch {
      toast.error("Failed to save method");
    }
  };

  /**
   * Compute the calendar event location + description fields from the
   * selected follow-up method. If in-person → business address;
   * if email → contact email; if phone → contact phone.
   */
  const computeCalendarFields = () => {
    if (!company)
      return { location: null, phone: null, address: null };
    if (followUpMethod === "in_person") {
      return {
        location: company.address ?? null,
        phone: null,
        address: company.address ?? null,
      };
    }
    if (followUpMethod === "email") {
      return {
        location: contactEmail || contact?.email || company.email || null,
        phone: null,
        address: null,
      };
    }
    if (followUpMethod === "phone") {
      return {
        location: contactPhone || contact?.phone || company.phone || null,
        phone: contactPhone || contact?.phone || company.phone || null,
        address: null,
      };
    }
    return { location: null, phone: company.phone, address: company.address };
  };

  const scheduleCallback = async () => {
    if (!company || !callbackDate) return;
    setSchedulingCallback(true);
    try {
      const [hh, mm] = callbackTime.split(":").map(Number);
      const dt = new Date(callbackDate);
      dt.setHours(hh, mm, 0, 0);

      const existingEventId = company.calendar_event_id;
      const isUpdate = !!existingEventId;

      const { location, phone, address } = computeCalendarFields();

      const calRes = await fetch("/api/calendar/event", {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isUpdate ? { eventId: existingEventId } : {}),
          companyName: company.name,
          phone,
          address,
          location,
          method: followUpMethod || null,
          startTime: dt.toISOString(),
          notes: notes.map((n) => ({
            content: n.content,
            created_at: n.created_at,
            user_name: n.user_name,
          })),
          contact: contact
            ? { name: contact.name, email: contact.email, phone: contact.phone, notes: contact.notes }
            : null,
        }),
      });

      let calendarEventId: string | null = existingEventId ?? null;
      if (calRes.ok) {
        const calData = (await calRes.json()) as { eventId?: string };
        calendarEventId = calData.eventId ?? calendarEventId;
      }

      const patch = {
        callback_at: dt.toISOString(),
        calendar_event_id: calendarEventId,
      };
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed");

      if (!outcomes.includes("follow_up")) {
        const newOutcomes = [...outcomes, "follow_up"];
        await fetch(`/api/companies/${company.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcomes: newOutcomes }),
        });
        setOutcomes(newOutcomes);
        onUpdated(company.id, { outcomes: newOutcomes, ...patch });
      } else {
        onUpdated(company.id, patch);
      }

      toast.success(
        calendarEventId
          ? isUpdate
            ? "Follow up updated + calendar invite sent"
            : "Follow up scheduled + calendar invite sent"
          : isUpdate
            ? "Follow up updated"
            : "Follow up scheduled"
      );
    } catch {
      toast.error("Failed to schedule follow up");
    } finally {
      setSchedulingCallback(false);
    }
  };

  const [cancellingCallback, setCancellingCallback] = useState(false);

  const cancelCallback = async () => {
    if (!company) return;
    setCancellingCallback(true);
    try {
      if (company.calendar_event_id) {
        await fetch(`/api/calendar/event?eventId=${encodeURIComponent(company.calendar_event_id)}`, {
          method: "DELETE",
        });
      }

      const patch = { callback_at: null, calendar_event_id: null };
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed");

      const newOutcomes = outcomes.filter((o) => o !== "follow_up");
      if (newOutcomes.length !== outcomes.length) {
        await fetch(`/api/companies/${company.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcomes: newOutcomes }),
        });
        setOutcomes(newOutcomes);
        onUpdated(company.id, { outcomes: newOutcomes, ...patch });
      } else {
        onUpdated(company.id, patch);
      }

      setCallbackDate(undefined);
      setCallbackTime("10:00");
      toast.success("Follow up cancelled");
    } catch {
      toast.error("Failed to cancel follow up");
    } finally {
      setCancellingCallback(false);
    }
  };

  // Keyboard shortcuts for outcomes
  useEffect(() => {
    if (!open || !company) return;
    const handler = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (e.shiftKey || e.altKey) return;
      // Let Cmd+Z pass through to the global undo handler — don't intercept it here
      if (e.key.toLowerCase() === "z") return;

      const outcome = OUTCOME_OPTIONS.find((o) => o.shortcut === e.key);
      if (outcome) {
        e.preventDefault();
        toggleOutcome(outcome.value);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, company, toggleOutcome]);

  if (!company) return null;

  const showReasonDropdown = outcomes.includes("not_interested");
  const showFollowUp = outcomes.includes("follow_up");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-full sm:max-w-[540px] md:max-w-[720px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className="truncate">{company.name}</span>
            {company.verified && (
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
            )}
            {(opportunityLink || company.outcomes?.includes("send_website")) && (
              <a
                href="/opportunities"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline ml-auto shrink-0"
              >
                <ExternalLink className="h-3 w-3" />
                Opportunity
              </a>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-3 sm:px-4 py-4 space-y-5">
          {/* Contact info */}
          <div className="space-y-2 text-sm">
            {company.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`tel:${company.phone}`}
                  className="text-primary hover:underline font-mono"
                >
                  {company.phone}
                </a>
              </div>
            )}
            {company.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`mailto:${company.email}`}
                  className="text-primary hover:underline truncate"
                >
                  {company.email}
                </a>
              </div>
            )}
            {company.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={
                    company.website.startsWith("http")
                      ? company.website
                      : `https://${company.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline truncate"
                >
                  {company.website
                    .replace(/^https?:\/\//, "")
                    .replace(/^www\./, "")}
                </a>
              </div>
            )}
            {company.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{company.address}</span>
              </div>
            )}
            {company.prototype_url && (
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={
                    company.prototype_url.startsWith("http")
                      ? company.prototype_url
                      : `https://${company.prototype_url}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline truncate text-sm"
                >
                  View Prototype
                </a>
              </div>
            )}
            {company.rating && (
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                {company.location_link ? (
                  <a
                    href={company.location_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {company.rating} · {company.reviews ?? 0} reviews
                  </a>
                ) : (
                  <span>
                    {company.rating} · {company.reviews ?? 0} reviews
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Working hours */}
          {(() => {
            const status = openStatusLabel(company.working_hours);
            const weekHours = allHoursFormatted(company.working_hours);
            if (!status && !weekHours) return null;
            return (
              <div className="border rounded-md p-2.5 bg-muted/20 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {status ? (
                    <span
                      className={`text-xs font-medium ${status.open ? "text-green-600" : "text-destructive"}`}
                    >
                      ● {status.label}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Hours</span>
                  )}
                </div>
                {weekHours && (
                  <table className="text-[11px] w-full">
                    <tbody>
                      {weekHours.map(({ day, hours, isToday }) => (
                        <tr
                          key={day}
                          className={isToday ? "font-medium" : "text-muted-foreground"}
                        >
                          <td className="pr-3 w-10 opacity-80">{day}</td>
                          <td>{hours}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })()}

          {/* Tags */}
          {(company.subtypes?.length || company.postal_code) && (
            <div className="flex flex-wrap gap-1">
              {company.subtypes?.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {s}
                </Badge>
              ))}
              {company.postal_code && (
                <Badge variant="outline" className="text-xs font-mono">
                  {company.postal_code}
                </Badge>
              )}
            </div>
          )}

          <Separator />

          {/* Outcomes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Outcomes</Label>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Keyboard className="h-3 w-3" />
                <span>
                  Press <Kbd>{modKey}</Kbd>+<Kbd>1</Kbd>–<Kbd>6</Kbd>
                </span>
                {savingOutcomes && (
                  <Loader2 className="h-3 w-3 animate-spin ml-1" />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {OUTCOME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = outcomes.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleOutcome(opt.value)}
                    className={`inline-flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-accent"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {opt.label}
                    </span>
                    <Kbd>
                      {modKey}
                      {opt.shortcut}
                    </Kbd>
                  </button>
                );
              })}
            </div>

            {/* Not Interested reason */}
            {showReasonDropdown && (
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Reason for not interested
                </Label>
                <Select
                  value={notInterestedReason ?? ""}
                  onValueChange={(v) => v && updateReason(v)}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select a reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {NOT_INTERESTED_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Follow up scheduler */}
          {showFollowUp && (
            <div className="border rounded-md p-3 bg-muted/20 space-y-3">
              <Label className="text-sm font-semibold">Schedule follow up</Label>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Method
                </Label>
                <Select
                  value={followUpMethod || undefined}
                  onValueChange={(v) => updateFollowUpMethod(v as FollowUpMethod)}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Choose method…" />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLLOW_UP_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {followUpMethod && (
                  <button
                    type="button"
                    onClick={() => updateFollowUpMethod("")}
                    className="text-[10px] text-muted-foreground hover:text-destructive mt-0.5"
                  >
                    Clear
                  </button>
                )}
                {followUpMethod && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {followUpMethod === "in_person"
                      ? `Where: ${company.address ?? "—"}`
                      : followUpMethod === "email"
                        ? `Where: ${contactEmail || contact?.email || company.email || "—"}`
                        : `Where: ${contactPhone || contact?.phone || company.phone || "—"}`}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-start gap-2">
                <Calendar
                  mode="single"
                  selected={callbackDate}
                  onSelect={setCallbackDate}
                  disabled={(d) =>
                    d < new Date(new Date().setHours(0, 0, 0, 0))
                  }
                  className="rounded border bg-background"
                />
                <div className="flex-1 space-y-2 w-full">
                  <Select
                    value={callbackTime}
                    onValueChange={(v) => v && setCallbackTime(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={scheduleCallback}
                    disabled={!callbackDate || schedulingCallback || cancellingCallback}
                    className="w-full px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                  >
                    {schedulingCallback && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    {company.callback_at
                      ? "Update follow up"
                      : "Schedule + invite"}
                  </button>
                  {company.callback_at && (
                    <>
                      <p className="text-[10px] text-muted-foreground">
                        Current:{" "}
                        {new Date(company.callback_at).toLocaleString()}
                      </p>
                      <button
                        onClick={cancelCallback}
                        disabled={cancellingCallback || schedulingCallback}
                        className="w-full px-3 py-1.5 text-xs border border-destructive/50 text-destructive rounded hover:bg-destructive/10 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                      >
                        {cancellingCallback && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        Cancel follow up
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Contact */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold block">Contact</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Name</Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  onBlur={(e) => saveContactField({ name: e.target.value || null })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  placeholder="e.g. Sarah Jones"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Email</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  onBlur={(e) => saveContactField({ email: e.target.value || null })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  placeholder="name@example.com"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Phone</Label>
                <Input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  onBlur={(e) => saveContactField({ phone: e.target.value || null })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  placeholder="+44 ..."
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Notes</Label>
              <Textarea
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                onBlur={(e) => saveContactField({ notes: e.target.value || null })}
                placeholder="Anything worth remembering about this contact"
                rows={2}
                className="text-sm"
              />
            </div>
          </div>

          {/* Prototype URL */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Prototype</Label>
            <Input
              type="url"
              defaultValue={company.prototype_url ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v === (company.prototype_url ?? null)) return;
                fetch(`/api/companies/${company.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ prototype_url: v }),
                }).then(async (res) => {
                  if (!res.ok) throw new Error("Failed");
                  onUpdated(company.id, { prototype_url: v });
                }).catch(() => toast.error("Failed to save prototype URL"));
              }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              placeholder="https://..."
              className="h-8 text-sm"
            />
          </div>

          <Separator />

          {/* Meeting Notes */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">
              Meeting Notes
            </Label>
            <Textarea
              ref={textareaRef}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  postNote();
                }
              }}
              placeholder="Type a note, press Enter to save (Shift+Enter for newline)"
              rows={2}
              className="text-sm"
              disabled={postingNote || !user}
            />

            <div className="mt-3 space-y-2">
              {loadingNotes ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : notes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No notes yet. Add the first one above.
                </p>
              ) : (
                notes.map((n) => (
                  <div
                    key={n.id}
                    className="text-sm bg-muted/40 rounded px-2 py-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground mb-0.5">
                      <span className="font-medium">
                        {n.user_name ?? n.user_email ?? "Someone"}
                      </span>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{n.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
