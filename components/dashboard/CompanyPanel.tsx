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
  Globe,
  Keyboard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import {
  OUTCOME_OPTIONS,
  NOT_INTERESTED_REASONS,
  PAIN_POINTS,
} from "@/lib/outcomes";
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

  const [callbackDate, setCallbackDate] = useState<Date | undefined>();
  const [callbackTime, setCallbackTime] = useState<string>("10:00");
  const [schedulingCallback, setSchedulingCallback] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset on company change
  useEffect(() => {
    if (!company) return;
    setOutcomes(company.outcomes ?? []);
    setPainPoints(company.pain_points ?? []);
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

      const calRes = await fetch("/api/calendar/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          companyName: company.name,
          phone: company.phone,
          address: company.address,
          startTime: dt.toISOString(),
        }),
      });

      let calendarEventId: string | null = null;
      if (calRes.ok) {
        const calData = (await calRes.json()) as { eventId?: string };
        calendarEventId = calData.eventId ?? null;
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
          ? "Callback scheduled + calendar invite sent"
          : "Callback scheduled"
      );
    } catch {
      toast.error("Failed to schedule callback");
    } finally {
      setSchedulingCallback(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!open || !company) return;
    const handler = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      // Don't hijack text-field usage for modifier combos that are common (e.g. copy/paste use shift too)
      if (e.shiftKey || e.altKey) return;

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
      <SheetContent className="min-w-[520px] sm:min-w-[600px] p-0 overflow-y-auto">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className="truncate">{company.name}</span>
            {company.verified && (
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 py-4 space-y-5">
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
            {company.rating && (
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>
                  {company.rating} · {company.reviews ?? 0} reviews
                </span>
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
            <div className="grid grid-cols-2 gap-1.5">
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
              <div className="flex items-start gap-2">
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
                    disabled={!callbackDate || schedulingCallback}
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
                    <p className="text-[10px] text-muted-foreground">
                      Current:{" "}
                      {new Date(company.callback_at).toLocaleString()}
                    </p>
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
            <div className="grid grid-cols-2 gap-1.5">
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
      </SheetContent>
    </Sheet>
  );
}
