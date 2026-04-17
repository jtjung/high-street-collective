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
  { value: "call_back_later", label: "Call Back Later", shortcut: "5", icon: Clock },
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

export type PainPointOption = {
  value: string;
  label: string;
  shortcut: string; // letter, used with Cmd
};

// Chosen letters map roughly to first-letter-of-word so they're memorable
export const PAIN_POINTS: PainPointOption[] = [
  { value: "slow_website", label: "Slow / broken website", shortcut: "w" },
  { value: "no_online_presence", label: "Weak online presence", shortcut: "o" },
  { value: "missed_calls", label: "Missing calls", shortcut: "m" },
  { value: "no_bookings", label: "Not enough bookings", shortcut: "b" },
  { value: "social_media", label: "No time for social media", shortcut: "s" },
  { value: "reviews", label: "Poor / few reviews", shortcut: "r" },
  { value: "google_ranking", label: "Not ranking on Google", shortcut: "g" },
  { value: "ads_not_working", label: "Ads not converting", shortcut: "a" },
  { value: "staffing", label: "Staffing / team capacity", shortcut: "t" },
  { value: "competition", label: "Local competition", shortcut: "c" },
];

export const painPointLabel = (value: string): string =>
  PAIN_POINTS.find((p) => p.value === value)?.label ?? value;

export type UserGoalOption = {
  value: string;
  label: string;
};

export const USER_GOALS: UserGoalOption[] = [
  { value: "more_customers", label: "More customers" },
  { value: "more_bookings", label: "More bookings" },
  { value: "better_online_presence", label: "Better online presence" },
  { value: "more_reviews", label: "More reviews" },
  { value: "social_media_growth", label: "Social media growth" },
  { value: "better_website", label: "Better website" },
  { value: "google_ranking", label: "Rank higher on Google" },
  { value: "more_enquiries", label: "More enquiries / leads" },
  { value: "brand_awareness", label: "Local brand awareness" },
  { value: "less_admin", label: "Less admin / automation" },
];

export const userGoalLabel = (value: string): string =>
  USER_GOALS.find((g) => g.value === value)?.label ?? value;
