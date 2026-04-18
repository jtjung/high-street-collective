import {
  CheckCircle2,
  PhoneOff,
  Voicemail,
  Globe,
  Clock,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type OutcomeOption = {
  value: string;
  label: string;
  shortcut: string; // e.g. "1"
  icon: LucideIcon;
};

export const OUTCOME_OPTIONS: OutcomeOption[] = [
  { value: "interested", label: "Interested", shortcut: "1", icon: CheckCircle2 },
  { value: "dead_number", label: "Dead Number", shortcut: "2", icon: PhoneOff },
  { value: "voicemail", label: "Voicemail", shortcut: "3", icon: Voicemail },
  { value: "send_website", label: "Send Website", shortcut: "4", icon: Globe },
  { value: "follow_up", label: "Follow Up", shortcut: "5", icon: Clock },
  { value: "not_interested", label: "Not Interested", shortcut: "6", icon: XCircle },
];

export const outcomeLabel = (value: string): string =>
  OUTCOME_OPTIONS.find((o) => o.value === value)?.label ?? value;

export const NOT_INTERESTED_REASONS = [
  { value: "already_has_provider", label: "Already has a provider" },
  { value: "too_expensive", label: "Too expensive / budget" },
  { value: "not_a_priority", label: "Not a priority right now" },
  { value: "tried_before_didnt_work", label: "Tried before, didn't work" },
  { value: "too_busy", label: "Too busy to engage" },
  { value: "closing_or_selling", label: "Closing / selling business" },
  { value: "wrong_decision_maker", label: "Not the decision maker" },
  { value: "no_reason_given", label: "No specific reason given" },
  { value: "other", label: "Other" },
] as const;

export type FollowUpMethod = "in_person" | "email" | "phone";

export const FOLLOW_UP_METHODS: { value: FollowUpMethod; label: string }[] = [
  { value: "in_person", label: "In person" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
];

export const followUpMethodLabel = (value: string | null | undefined): string =>
  FOLLOW_UP_METHODS.find((m) => m.value === value)?.label ?? "—";
