export const TEAM_MEMBERS = [
  { name: "JJ", email: "jtj0828@gmail.com" },
  // Add more team members here
] as const;

export const TEAM_EMAILS = TEAM_MEMBERS.map((m) => m.email);
