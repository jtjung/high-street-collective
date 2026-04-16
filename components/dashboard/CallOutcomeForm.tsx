"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/types";

type Company = Tables<"companies">;

const OUTCOMES = [
  { value: "interested", label: "Interested", color: "text-green-600" },
  { value: "dead_number", label: "Dead Number", color: "text-red-600" },
  { value: "voicemail", label: "Voicemail", color: "text-yellow-600" },
  {
    value: "send_website",
    label: "Send Website",
    color: "text-blue-600",
  },
  {
    value: "call_back_later",
    label: "Call Back Later",
    color: "text-purple-600",
  },
  {
    value: "not_interested",
    label: "Not Interested",
    color: "text-gray-600",
  },
];

const TIME_SLOTS = Array.from({ length: 37 }, (_, i) => {
  const hour = Math.floor(i / 4) + 9;
  const minute = (i % 4) * 15;
  if (hour > 18) return null;
  return {
    value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    label: `${hour > 12 ? hour - 12 : hour}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`,
  };
}).filter(Boolean) as { value: string; label: string }[];

interface CallOutcomeFormProps {
  company: Company;
  notes: string;
  onNotesChange: (notes: string) => void;
  onSaved: () => void;
}

export function CallOutcomeForm({
  company,
  notes,
  onNotesChange,
  onSaved,
}: CallOutcomeFormProps) {
  const { user } = useUser();
  const [outcome, setOutcome] = useState<string | null>(null);
  const [callbackDate, setCallbackDate] = useState<Date | undefined>();
  const [callbackTime, setCallbackTime] = useState<string>("10:00");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!outcome) {
      toast.error("Please select a call outcome");
      return;
    }

    if (outcome === "call_back_later" && !callbackDate) {
      toast.error("Please select a callback date");
      return;
    }

    setSaving(true);

    try {
      let calendarEventId: string | undefined;

      // Create calendar event if call back later
      if (outcome === "call_back_later" && callbackDate) {
        const [hours, minutes] = callbackTime.split(":").map(Number);
        const callbackDatetime = new Date(callbackDate);
        callbackDatetime.setHours(hours, minutes, 0, 0);

        const calRes = await fetch("/api/calendar/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: company.name,
            companyPhone: company.phone,
            companyAddress: company.address,
            callbackDatetime: callbackDatetime.toISOString(),
            notes,
          }),
        });

        if (calRes.ok) {
          const calData = await calRes.json();
          calendarEventId = calData.eventId;
          toast.success("Calendar invite created");
        } else {
          const calErr = await calRes.json();
          toast.warning(
            `Calendar invite failed: ${calErr.error}. Saving call log anyway.`
          );
        }
      }

      // Build callback datetime
      let callbackDatetime: string | undefined;
      if (outcome === "call_back_later" && callbackDate) {
        const [hours, minutes] = callbackTime.split(":").map(Number);
        const dt = new Date(callbackDate);
        dt.setHours(hours, minutes, 0, 0);
        callbackDatetime = dt.toISOString();
      }

      // Save call log
      const res = await fetch(`/api/companies/${company.id}/call-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          notes,
          callbackDatetime,
          calendarEventId,
          userEmail: user?.primaryEmailAddress?.emailAddress,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      toast.success("Call logged successfully");
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save call log"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Notes */}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Add notes about the call..."
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          className="mt-1"
        />
      </div>

      {/* Outcome Selection */}
      <div>
        <Label>Call Outcome</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {OUTCOMES.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setOutcome(opt.value)}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors text-left",
                outcome === opt.value
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                  : "border-gray-200 hover:bg-gray-50"
              )}
            >
              <div
                className={cn(
                  "h-3 w-3 rounded-full border-2",
                  outcome === opt.value
                    ? "border-blue-500 bg-blue-500"
                    : "border-gray-300"
                )}
              />
              <span className={outcome === opt.value ? opt.color : ""}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Callback Scheduler */}
      {outcome === "call_back_later" && (
        <div className="rounded-lg border bg-purple-50 p-4 space-y-3">
          <Label className="text-purple-800">Schedule Callback</Label>
          <div className="flex gap-3">
            <Popover>
              <PopoverTrigger
                className={cn(
                  "flex h-9 w-48 items-center justify-start gap-2 rounded-md border bg-background px-3 text-sm font-normal",
                  !callbackDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {callbackDate
                  ? format(callbackDate, "PPP")
                  : "Pick a date"}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={callbackDate}
                  onSelect={setCallbackDate}
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>

            <Select value={callbackTime} onValueChange={(v) => v && setCallbackTime(v)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value}>
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-purple-600">
            A calendar invite will be sent to all team members.
          </p>
        </div>
      )}

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={saving || !outcome}
        className="w-full"
      >
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Call Log
      </Button>
    </div>
  );
}
