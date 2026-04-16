export const OUTCOME_OPTIONS = [
  { value: "interested", label: "Interested" },
  { value: "dead_number", label: "Dead Number" },
  { value: "voicemail", label: "Voicemail" },
  { value: "send_website", label: "Send Website" },
  { value: "call_back_later", label: "Call Back Later" },
  { value: "not_interested", label: "Not Interested" },
] as const;

export type OutcomeValue = (typeof OUTCOME_OPTIONS)[number]["value"];

export const outcomeLabel = (value: string): string =>
  OUTCOME_OPTIONS.find((o) => o.value === value)?.label ?? value;
