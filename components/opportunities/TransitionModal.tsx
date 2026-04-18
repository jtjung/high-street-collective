"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { addDays, addMonths, format } from "date-fns";
import { toast } from "sonner";
import { STATUSES, type Opportunity, type StatusValue } from "./KanbanBoard";

const TIMES = Array.from({ length: (20 - 8) * 4 }, (_, i) => {
  const h = 8 + Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

function DateInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
    </div>
  );
}

interface TransitionModalProps {
  opportunity: Opportunity;
  onComplete: (updated: Opportunity) => void;
  onCancel: () => void;
}

export function TransitionModal({ opportunity, onComplete, onCancel }: TransitionModalProps) {
  const currentIdx = STATUSES.findIndex((s) => s.value === opportunity.status);
  const nextStatus = STATUSES[currentIdx + 1];
  const [saving, setSaving] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const todayPlus1 = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const todayPlus1Month = format(addMonths(new Date(), 1), "yyyy-MM-dd");

  // Send Website → Sent Website
  const [sampleWebsite, setSampleWebsite] = useState(opportunity.sample_website ?? "");
  const [sentDate, setSentDate] = useState(today);
  const [followUpDate, setFollowUpDate] = useState(todayPlus1);

  // Sent Website → Discovery Meeting Booked
  const existingContact = opportunity.company?.contact?.name ?? null;
  const contacts = [
    existingContact ? { value: existingContact, label: existingContact } : null,
    { value: "__other__", label: "Other..." },
  ].filter(Boolean) as { value: string; label: string }[];

  const [meetingContact, setMeetingContact] = useState<string>(
    existingContact ?? "__other__"
  );
  const [otherContactName, setOtherContactName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("10:00");

  // Discovery Meeting Booked → In Pilot
  const [pilotStartDate, setPilotStartDate] = useState(today);
  const [pilotEndDate, setPilotEndDate] = useState(todayPlus1Month);

  if (!nextStatus) return null;

  const transitionType = `${opportunity.status}_to_${nextStatus.value}` as
    | "send_website_to_sent_website"
    | "sent_website_to_discovery_meeting_booked"
    | "discovery_meeting_booked_to_in_pilot"
    | "in_pilot_to_proposal";

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = { status: nextStatus.value };

      if (transitionType === "send_website_to_sent_website") {
        if (!sampleWebsite.trim()) { toast.error("Sample website is required"); setSaving(false); return; }
        if (!sentDate) { toast.error("Sent date is required"); setSaving(false); return; }
        if (!followUpDate) { toast.error("Follow-up date is required"); setSaving(false); return; }
        patch.sample_website = sampleWebsite.trim();
        patch.sent_date = sentDate;
        patch.follow_up_date = followUpDate;
      }

      if (transitionType === "sent_website_to_discovery_meeting_booked") {
        const contactName = meetingContact === "__other__" ? otherContactName.trim() : meetingContact;
        if (!contactName) { toast.error("Please select or enter a contact"); setSaving(false); return; }
        if (!meetingDate) { toast.error("Meeting date is required"); setSaving(false); return; }
        const [hh, mm] = meetingTime.split(":").map(Number);
        const meetingDt = new Date(`${meetingDate}T${meetingTime}:00`);
        meetingDt.setHours(hh, mm, 0, 0);
        patch.discovery_meeting_contact = contactName;
        patch.discovery_meeting_at = meetingDt.toISOString();

        if (meetingContact === "__other__" && otherContactName.trim() && opportunity.company) {
          await fetch(`/api/companies/${opportunity.company.id}/contact`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: otherContactName.trim(),
              email: opportunity.company.contact?.email ?? null,
              phone: opportunity.company.contact?.phone ?? null,
              notes: null,
            }),
          });
        }

        if (opportunity.company) {
          try {
            const calRes = await fetch("/api/calendar/event", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                companyId: opportunity.company.id,
                companyName: opportunity.company.name,
                phone: opportunity.company.phone,
                address: opportunity.company.address,
                startTime: meetingDt.toISOString(),
                durationMinutes: 60,
                summary: `Discovery Meeting: ${opportunity.company.name}`,
              }),
            });
            if (calRes.ok) {
              const calData = (await calRes.json()) as { eventId?: string };
              if (calData.eventId) patch.discovery_calendar_event_id = calData.eventId;
            }
          } catch { /* Calendar is best-effort */ }
        }
      }

      if (transitionType === "discovery_meeting_booked_to_in_pilot") {
        if (!pilotStartDate) { toast.error("Start date is required"); setSaving(false); return; }
        if (!pilotEndDate) { toast.error("End date is required"); setSaving(false); return; }
        patch.pilot_start_date = pilotStartDate;
        patch.pilot_end_date = pilotEndDate;
      }

      const res = await fetch(`/api/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = (await res.json()) as Opportunity;
      toast.success(`Moved to ${nextStatus.label}`);
      onComplete({ ...opportunity, ...updated });
    } catch {
      toast.error("Failed to advance opportunity");
    } finally {
      setSaving(false);
    }
  };

  const titles: Record<string, string> = {
    send_website_to_sent_website: "Mark as Sent Website",
    sent_website_to_discovery_meeting_booked: "Book Discovery Meeting",
    discovery_meeting_booked_to_in_pilot: "Start Pilot",
    in_pilot_to_proposal: "Move to Proposal",
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titles[transitionType] ?? `Move to ${nextStatus.label}`}</DialogTitle>
          <p className="text-sm text-muted-foreground">{opportunity.company?.name}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {transitionType === "send_website_to_sent_website" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sample Website URL</Label>
                <Input
                  value={sampleWebsite}
                  onChange={(e) => setSampleWebsite(e.target.value)}
                  placeholder="https://example-site.com"
                  className="h-9"
                />
              </div>
              <DateInput value={sentDate} onChange={setSentDate} label="Sent Date" />
              <DateInput value={followUpDate} onChange={setFollowUpDate} label="Follow-up Date (default +1 day)" />
            </>
          )}

          {transitionType === "sent_website_to_discovery_meeting_booked" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Meeting with</Label>
                <Select value={meetingContact} onValueChange={(v) => v && setMeetingContact(v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {meetingContact === "__other__" && (
                <div className="space-y-2 pl-2 border-l-2 border-muted">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Contact name</Label>
                    <Input
                      value={otherContactName}
                      onChange={(e) => setOtherContactName(e.target.value)}
                      placeholder="e.g. James Smith"
                      className="h-9"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Will be saved to the company&apos;s contact record.
                    </p>
                  </div>
                </div>
              )}

              <DateInput value={meetingDate} onChange={setMeetingDate} label="Meeting Date" />

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Meeting Time</Label>
                <Select value={meetingTime} onValueChange={(v) => v && setMeetingTime(v)}>
                  <SelectTrigger className="h-9">
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
              </div>
              <p className="text-xs text-muted-foreground">
                A 1-hour Google Calendar invite will be created automatically.
              </p>
            </>
          )}

          {transitionType === "discovery_meeting_booked_to_in_pilot" && (
            <>
              <DateInput value={pilotStartDate} onChange={setPilotStartDate} label="Pilot Start Date" />
              <DateInput value={pilotEndDate} onChange={setPilotEndDate} label="Pilot End Date (default +1 month)" />
            </>
          )}

          {transitionType === "in_pilot_to_proposal" && (
            <p className="text-sm text-muted-foreground">
              Move this opportunity to the Proposal stage?
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : `Move to ${nextStatus.label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
