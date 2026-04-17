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
  ExternalLink,
  Globe,
  History,
  Keyboard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  OUTCOME_OPTIONS,
  NOT_INTERESTED_REASONS,
  PAIN_POINTS,
  USER_GOALS,
} from "@/lib/outcomes";
import { Input } from "@/components/ui/input";
import { useCallHistory } from "@/lib/call-history";
import type { Company } from "@/lib/use-companies";
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
  const {
    history: callHistory,
    loading: callHistoryLoading,
    log: logCall,
    remove: removeCall,
  } = useCallHistory(company?.id ?? null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [postingNote, setPostingNote] = useState(false);

  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [savingOutcomes, setSavingOutcomes] = useState(false);
  const [notInterestedReason, setNotInterestedReason] = useState<string | null>(
    null
  );
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [userGoals, setUserGoals] = useState<string[]>([]);
  const [managerName, setManagerName] = useState<string>("");
  const [ownerName, setOwnerName] = useState<string>("");

  const [callbackDate, setCallbackDate] = useState<Date | undefined>();
  const [callbackTime, setCallbackTime] = useState<string>("10:00");
  const [schedulingCallback, setSchedulingCallback] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset on company change
  useEffect(() => {
    if (!company) return;
    setOutcomes(company.outcomes ?? []);
    setPainPoints(company.pain_points ?? []);
    setUserGoals(company.user_goals ?? []);
    setManagerName(company.manager_name ?? "");
    setOwnerName(company.owner_name ?? "");
    setNotInterestedReason(company.not_interested_reason ?? null);
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

  const togglePainPoint = useCallback(
    async (value: string) => {
      if (!company) return;
      const next = painPoints.includes(value)
        ? painPoints.filter((p) => p !== value)
        : [...painPoints, value];
      setPainPoints(next);
      try {
        const res = await fetch(`/api/companies/${company.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pain_points: next }),
        });
        if (!res.ok) throw new Error("Failed");
        onUpdated(company.id, { pain_points: next });
      } catch {
        toast.error("Failed to save pain points");
        setPainPoints(painPoints);
      }
    },
    [company, painPoints, onUpdated]
  );

  const toggleUserGoal = useCallback(
    async (value: string) => {
      if (!company) return;
      const next = userGoals.includes(value)
        ? userGoals.filter((g) => g !== value)
        : [...userGoals, value];
      setUserGoals(next);
      try {
        const res = await fetch(`/api/companies/${company.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_goals: next }),
        });
        if (!res.ok) throw new Error("Failed");
        onUpdated(company.id, { user_goals: next });
      } catch {
        toast.error("Failed to save goals");
        setUserGoals(userGoals);
      }
    },
    [company, userGoals, onUpdated]
  );

  const saveTextField = useCallback(
    async (field: "manager_name" | "owner_name", value: string) => {
      if (!company) return;
      try {
        const res = await fetch(`/api/companies/${company.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value || null }),
        });
        if (!res.ok) throw new Error("Failed");
        onUpdated(company.id, { [field]: value || null });
      } catch {
        toast.error("Failed to save");
      }
    },
    [company, onUpdated]
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

  const scheduleCallback = async () => {
    if (!company || !callbackDate) return;
    setSchedulingCallback(true);
    try {
      const [hh, mm] = callbackTime.split(":").map(Number);
      const dt = new Date(callbackDate);
      dt.setHours(hh, mm, 0, 0);

      const existingEventId = company.calendar_event_id;
      const isUpdate = !!existingEventId;

      const calRes = await fetch("/api/calendar/event", {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isUpdate ? { eventId: existingEventId } : {}),
          companyName: company.name,
          phone: company.phone,
          address: company.address,
          startTime: dt.toISOString(),
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

      if (!outcomes.includes("call_back_later")) {
        const newOutcomes = [...outcomes, "call_back_later"];
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
            ? "Callback updated + calendar invite sent"
            : "Callback scheduled + calendar invite sent"
          : isUpdate
            ? "Callback updated"
            : "Callback scheduled"
      );
    } catch {
      toast.error("Failed to schedule callback");
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

      const newOutcomes = outcomes.filter((o) => o !== "call_back_later");
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
      toast.success("Callback cancelled");
    } catch {
      toast.error("Failed to cancel callback");
    } finally {
      setCancellingCallback(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!open || !company) return;
    const handler = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (e.shiftKey || e.altKey) return;
      // Let Cmd+Z pass through to the global undo handler — don't intercept it here
      if (e.key.toLowerCase() === "z") return;

      // Outcomes: Cmd+1..6
      const outcome = OUTCOME_OPTIONS.find((o) => o.shortcut === e.key);
      if (outcome) {
        e.preventDefault();
        toggleOutcome(outcome.value);
        return;
      }

      // Pain points: Cmd+letter
      const pain = PAIN_POINTS.find(
        (p) => p.shortcut.toLowerCase() === e.key.toLowerCase()
      );
      if (pain) {
        e.preventDefault();
        togglePainPoint(pain.value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, company, toggleOutcome, togglePainPoint]);

  if (!company) return null;

  const showReasonDropdown = outcomes.includes("not_interested");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-full sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] lg:min-w-[960px] p-0 flex flex-col">
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

        <div className="flex flex-col lg:flex-row flex-1 min-h-0">
          {/* Main details column */}
          <div className="flex-1 px-3 sm:px-4 py-4 space-y-5 overflow-y-auto">
          {/* Contact info */}
          <div className="space-y-2 text-sm">
            {company.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`tel:${company.phone}`}
                  onClick={() => logCall()}
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
              <Label className="text-sm font-semibold">Call outcomes</Label>
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

          {/* Callback scheduler */}
          {outcomes.includes("call_back_later") && (
            <div className="border rounded-md p-3 bg-muted/20 space-y-2">
              <Label className="text-sm font-semibold">Schedule callback</Label>
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
                <div className="flex-1 space-y-2">
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
                      ? "Update callback"
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
                        Cancel callback
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Pain Points */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">User pain points</Label>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Keyboard className="h-3 w-3" />
                <span>
                  <Kbd>{modKey}</Kbd>+<Kbd>letter</Kbd>
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {PAIN_POINTS.map((pain) => {
                const active = painPoints.includes(pain.value);
                return (
                  <button
                    key={pain.value}
                    onClick={() => togglePainPoint(pain.value)}
                    className={`inline-flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-accent"
                    }`}
                  >
                    <span className="text-left truncate">{pain.label}</span>
                    <Kbd>
                      {modKey}
                      {pain.shortcut.toUpperCase()}
                    </Kbd>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Contact names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Manager name</Label>
              <Input
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                onBlur={(e) => saveTextField("manager_name", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                placeholder="e.g. Sarah Jones"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Owner / Landlord name</Label>
              <Input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                onBlur={(e) => saveTextField("owner_name", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                placeholder="e.g. Tom Smith"
                className="h-8 text-sm"
              />
            </div>
          </div>

          <Separator />

          {/* User Goals */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">User goals</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {USER_GOALS.map((goal) => {
                const active = userGoals.includes(goal.value);
                return (
                  <button
                    key={goal.value}
                    onClick={() => toggleUserGoal(goal.value)}
                    className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors text-left ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-accent"
                    }`}
                  >
                    <span className="truncate">{goal.label}</span>
                  </button>
                );
              })}
            </div>
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
          {/* /Main details column */}

          {/* Call history panel */}
          <aside className="order-first lg:order-none w-full lg:w-[240px] shrink-0 border-b lg:border-b-0 lg:border-l bg-muted/20 flex flex-col lg:max-h-none max-h-[200px]">
            <div className="px-3 py-2.5 border-b shrink-0 flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 text-sm font-semibold">
                <History className="h-3.5 w-3.5" />
                Call History
              </div>
              <span className="text-[10px] text-muted-foreground">
                {callHistory.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {callHistoryLoading && callHistory.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  Loading...
                </p>
              ) : callHistory.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground italic">
                  No phone clicks recorded yet for this company.
                </p>
              ) : (
                <ul className="divide-y">
                  {callHistory.map((c) => (
                    <li
                      key={c.id}
                      className="group flex items-center justify-between gap-2 px-3 py-2 hover:bg-background/60"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium leading-tight truncate">
                            {new Date(c.ts).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "2-digit",
                            })}{" "}
                            <span className="font-mono text-muted-foreground">
                              {new Date(c.ts).toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {c.user_name ?? c.user_email ?? "—"}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeCall(c.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        title="Remove (accidental click)"
                        aria-label="Delete call record"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {company.phone && (
              <div className="px-3 py-2 border-t shrink-0">
                <button
                  onClick={() => logCall()}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md border bg-card hover:bg-accent transition-colors"
                  title="Log a call attempt for this company"
                >
                  <Phone className="h-3 w-3" />
                  Log call attempt
                </button>
              </div>
            )}
          </aside>
        </div>
      </SheetContent>
    </Sheet>
  );
}
