"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Globe,
  Mail,
  MapPin,
  Phone,
  Star,
  ArrowRight,
  Calendar,
  ExternalLink,
  XCircle,
  Trophy,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUSES, type Opportunity, type StatusValue } from "./KanbanBoard";
import { painPointLabel, userGoalLabel } from "@/lib/outcomes";
import { format } from "date-fns";

interface OpportunityPanelProps {
  opportunity: Opportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (updated: Opportunity) => void;
  onAdvance: (opp: Opportunity) => void;
  onLost: (opp: Opportunity) => void;
  onWon: (opp: Opportunity) => void;
  onChurned?: (opp: Opportunity) => void;
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUSES.find((s) => s.value === status)?.label ?? status;
  const colors: Record<StatusValue, string> = {
    send_website: "bg-slate-100 text-slate-700",
    sent_website: "bg-blue-100 text-blue-700",
    discovery_meeting_booked: "bg-violet-100 text-violet-700",
    in_pilot: "bg-amber-100 text-amber-700",
    proposal: "bg-green-100 text-green-700",
  };
  const color = colors[status as StatusValue] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

export function OpportunityPanel({
  opportunity: opp,
  open,
  onOpenChange,
  onAdvance,
  onLost,
  onWon,
  onChurned,
}: OpportunityPanelProps) {
  if (!opp) return null;

  const company = opp.company;
  const currentIdx = STATUSES.findIndex((s) => s.value === opp.status);
  const nextStatus = STATUSES[currentIdx + 1];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-full sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className="truncate">{company?.name ?? "Opportunity"}</span>
            {company?.verified && (
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
            )}
          </SheetTitle>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StatusBadge status={opp.status} />
            {nextStatus && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => { onOpenChange(false); onAdvance(opp); }}
              >
                <ArrowRight className="h-3 w-3" />
                Move to {nextStatus.label}
              </Button>
            )}
            {opp.status !== "customer" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 ml-auto"
                onClick={() => onWon(opp)}
              >
                <Trophy className="h-3 w-3" />
                Deal Won
              </Button>
            )}
            {opp.status !== "customer" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onLost(opp)}
              >
                <XCircle className="h-3 w-3" />
                Deal Lost
              </Button>
            )}
            {opp.status === "customer" && onChurned && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                onClick={() => onChurned(opp)}
              >
                <TrendingDown className="h-3 w-3" />
                Mark Churned
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Opportunity fields */}
          {(opp.sample_website || opp.sent_date || opp.follow_up_date ||
            opp.discovery_meeting_contact || opp.discovery_meeting_at ||
            opp.pilot_start_date || opp.pilot_end_date) && (
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opportunity Details</p>
              {opp.sample_website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <a
                    href={opp.sample_website.startsWith("http") ? opp.sample_website : `https://${opp.sample_website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate flex items-center gap-1"
                  >
                    {opp.sample_website.replace(/^https?:\/\//, "")}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              )}
              {opp.sent_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Sent: </span>
                  <span>{format(new Date(opp.sent_date), "dd MMM yyyy")}</span>
                </div>
              )}
              {opp.follow_up_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Follow-up: </span>
                  <span>{format(new Date(opp.follow_up_date), "dd MMM yyyy")}</span>
                </div>
              )}
              {opp.discovery_meeting_contact && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">With: </span>
                  <span className="font-medium">{opp.discovery_meeting_contact}</span>
                </div>
              )}
              {opp.discovery_meeting_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Meeting: </span>
                  <span>{format(new Date(opp.discovery_meeting_at), "dd MMM yyyy 'at' HH:mm")}</span>
                </div>
              )}
              {opp.pilot_start_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Pilot: </span>
                  <span>
                    {format(new Date(opp.pilot_start_date), "dd MMM")}
                    {opp.pilot_end_date && ` – ${format(new Date(opp.pilot_end_date), "dd MMM yyyy")}`}
                  </span>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Company contact info */}
          <div className="space-y-2 text-sm">
            {company?.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`tel:${company.phone}`} className="text-primary hover:underline font-mono">
                  {company.phone}
                </a>
              </div>
            )}
            {company?.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${company.email}`} className="text-primary hover:underline truncate">
                  {company.email}
                </a>
              </div>
            )}
            {company?.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline truncate"
                >
                  {company.website.replace(/^https?:\/\//, "").replace(/^www\./, "")}
                </a>
              </div>
            )}
            {company?.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{company.address}</span>
              </div>
            )}
            {company?.rating && (
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
                  <span>{company.rating} · {company.reviews ?? 0} reviews</span>
                )}
              </div>
            )}
          </div>

          {/* Contacts */}
          {(company?.manager_name || company?.owner_name) && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-sm">
                {company.manager_name && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Manager</p>
                    <p className="font-medium">{company.manager_name}</p>
                  </div>
                )}
                {company.owner_name && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Owner</p>
                    <p className="font-medium">{company.owner_name}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Tags */}
          {(company?.subtypes?.length || company?.postal_code) && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-1">
                {company?.subtypes?.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">
                    {s}
                  </Badge>
                ))}
                {company?.postal_code && (
                  <Badge variant="outline" className="text-xs font-mono">
                    {company.postal_code}
                  </Badge>
                )}
              </div>
            </>
          )}

          {/* Pain points */}
          {company?.pain_points && company.pain_points.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pain Points</p>
                <div className="flex flex-wrap gap-1.5">
                  {company.pain_points.map((p) => (
                    <Badge key={p} variant="outline" className="text-xs">
                      {painPointLabel(p)}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* User goals */}
          {company?.user_goals && company.user_goals.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Goals</p>
                <div className="flex flex-wrap gap-1.5">
                  {company.user_goals.map((g) => (
                    <Badge key={g} variant="outline" className="text-xs">
                      {userGoalLabel(g)}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />
          <div className="text-xs text-muted-foreground">
            Created {format(new Date(opp.created_at), "dd MMM yyyy")}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
