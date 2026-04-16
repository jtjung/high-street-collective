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
import { Checkbox } from "@/components/ui/checkbox";
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
  Loader2,
  Mail,
  MapPin,
  Phone,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { OUTCOME_OPTIONS, outcomeLabel } from "@/lib/outcomes";
import type { Company } from "@/lib/use-companies";
import type { Tables } from "@/lib/supabase/types";

type Note = Tables<"company_notes">;

const TIMES = Array.from({ length: (18 - 9) * 4 }, (_, i) => {
  const h = 9 + Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

interface CompanyPanelProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewMode: "details" | "maps";
  onUpdated: (id: string, patch: Partial<Company>) => void;
}

export function CompanyPanel({
  company,
  open,
  onOpenChange,
  viewMode,
  onUpdated,
}: CompanyPanelProps) {
  const { user } = useUser();
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [postingNote, setPostingNote] = useState(false);

  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [savingOutcomes, setSavingOutcomes] = useState(false);

  const [callbackDate, setCallbackDate] = useState<Date | undefined>();
  const [callbackTime, setCallbackTime] = useState<string>("10:00");
  const [schedulingCallback, setSchedulingCallback] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset on company change
  useEffect(() => {
    if (!company) return;
    setOutcomes(company.outcomes ?? []);
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
      toast.error("Failed to load comments");
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  useEffect(() => {
    if (company && open && viewMode === "details") {
      fetchNotes(company.id);
    }
  }, [company, open, viewMode, fetchNotes]);

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
      toast.error("Failed to save comment");
    } finally {
      setPostingNote(false);
      textareaRef.current?.focus();
    }
  };

  const toggleOutcome = async (value: string) => {
    if (!company) return;
    const next = outcomes.includes(value)
      ? outcomes.filter((o) => o !== value)
      : [...outcomes, value];
    setOutcomes(next);
    setSavingOutcomes(true);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcomes: next,
          last_called_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      onUpdated(company.id, { outcomes: next, last_called_at: new Date().toISOString() });
    } catch {
      toast.error("Failed to save outcome");
      setOutcomes(outcomes);
    } finally {
      setSavingOutcomes(false);
    }
  };

  const scheduleCallback = async () => {
    if (!company || !callbackDate) return;
    setSchedulingCallback(true);
    try {
      const [hh, mm] = callbackTime.split(":").map(Number);
      const dt = new Date(callbackDate);
      dt.setHours(hh, mm, 0, 0);

      // Create calendar event
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

      // Update company
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

      // Ensure "call_back_later" outcome is set
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
        calendarEventId ? "Callback scheduled + calendar invite sent" : "Callback scheduled"
      );
    } catch {
      toast.error("Failed to schedule callback");
    } finally {
      setSchedulingCallback(false);
    }
  };

  if (!company) return null;

  const mapsQuery = encodeURIComponent(
    `${company.name} ${company.address ?? ""}`
  );
  const mapsEmbedSrc = `https://maps.google.com/maps?q=${mapsQuery}&output=embed&z=17`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="min-w-[480px] sm:min-w-[560px] p-0 overflow-y-auto">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className="truncate">{company.name}</span>
            {company.verified && (
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
            )}
          </SheetTitle>
        </SheetHeader>

        {viewMode === "maps" ? (
          // --- Maps View ---
          <div className="flex flex-col h-[calc(100vh-60px)]">
            <iframe
              src={mapsEmbedSrc}
              className="w-full flex-1 border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="p-3 border-t bg-muted/30 text-xs space-y-1">
              <div className="flex items-start gap-2">
                <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground" />
                <span>{company.address || "No address"}</span>
              </div>
              {company.location_link && (
                <a
                  href={company.location_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open in Google Maps <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ) : (
          // --- Details View ---
          <div className="px-4 py-4 space-y-4">
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
                    {company.website.replace(/^https?:\/\//, "").replace(/^www\./, "")}
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

            {/* Outcomes (multi-select) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Call outcomes</Label>
                {savingOutcomes && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {OUTCOME_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-2 py-1"
                  >
                    <Checkbox
                      checked={outcomes.includes(opt.value)}
                      onCheckedChange={() => toggleOutcome(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Callback scheduler — always accessible */}
            {outcomes.includes("call_back_later") && (
              <div className="border rounded-md p-3 bg-muted/20 space-y-2">
                <Label className="text-sm font-medium">Schedule callback</Label>
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
                    <Select value={callbackTime} onValueChange={(v) => v && setCallbackTime(v)}>
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
                      {company.callback_at ? "Update callback" : "Schedule + invite"}
                    </button>
                    {company.callback_at && (
                      <p className="text-[10px] text-muted-foreground">
                        Current: {new Date(company.callback_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Comments */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Comments
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
                placeholder="Type a comment, press Enter to post (Shift+Enter for newline)"
                rows={2}
                className="text-sm"
                disabled={postingNote || !user}
              />

              <div className="mt-3 space-y-2">
                {loadingNotes ? (
                  <p className="text-xs text-muted-foreground">Loading...</p>
                ) : notes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No comments yet. Add the first one above.
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
        )}
      </SheetContent>
    </Sheet>
  );
}
