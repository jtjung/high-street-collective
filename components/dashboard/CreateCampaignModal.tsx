"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Company } from "@/lib/use-companies";

const METHODS = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "in_person", label: "In person" },
  { value: "mail", label: "Mail / leaflet" },
  { value: "other", label: "Other" },
];

interface CreateCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCompanies: Company[];
  onCreated?: (campaignId: string) => void;
}

export function CreateCampaignModal({
  open,
  onOpenChange,
  selectedCompanies,
  onCreated,
}: CreateCampaignModalProps) {
  const [name, setName] = useState("");
  const [method, setMethod] = useState("phone");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setMethod("phone");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setNotes("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!date) {
      toast.error("Date is required");
      return;
    }
    if (selectedCompanies.length === 0) {
      toast.error("Select at least one company");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          method,
          campaign_date: date,
          notes: notes.trim() || null,
          company_ids: selectedCompanies.map((c) => c.id),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error ?? "Failed");
      }
      const data = (await res.json()) as { campaign: { id: string } };
      toast.success(`Campaign "${name.trim()}" created with ${selectedCompanies.length} companies`);
      onCreated?.(data.campaign.id);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create campaign</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shoreditch Q2 leaflet drop"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Method</Label>
              <Select value={method} onValueChange={(v) => v && setMethod(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Campaign date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to remember about this campaign"
              rows={2}
            />
          </div>

          <div className="text-xs text-muted-foreground border rounded-md bg-muted/30 px-2.5 py-1.5">
            <span className="font-medium text-foreground">
              {selectedCompanies.length}
            </span>{" "}
            {selectedCompanies.length === 1 ? "company" : "companies"} will be added.
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Create campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
