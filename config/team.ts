export const TEAM_MEMBERS = [
  { name: "JT", email: "jt@highstreetcollective.org" },
  { name: "Nils", email: "nils@highstreetcollective.org" },
] as const;

export const TEAM_EMAILS = TEAM_MEMBERS.map((m) => m.email);
