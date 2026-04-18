import { auth, clerkClient } from "@clerk/nextjs/server";

// Admin emails — configurable via env var, with a small hardcoded default
// fallback so the app works out of the box for the founders.
const DEFAULT_ADMIN_EMAILS = ["jtj0828@gmail.com"];

function getAdminEmails(): string[] {
  const fromEnv = process.env.ADMIN_EMAILS;
  if (fromEnv) {
    return fromEnv
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }
  return DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase());
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

/**
 * Returns the current signed-in user's email (from Clerk), or null.
 * In AUTH_BYPASS mode, returns a dev email that is always treated as admin.
 */
export async function getCurrentUserEmail(): Promise<string | null> {
  if (process.env.AUTH_BYPASS === "true") {
    return "dev@bypass.local";
  }
  const { userId } = await auth();
  if (!userId) return null;
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return user.primaryEmailAddress?.emailAddress ?? null;
}

export async function requireAdmin(): Promise<
  { ok: true; email: string } | { ok: false; reason: "unauthorized" | "forbidden" }
> {
  if (process.env.AUTH_BYPASS === "true") {
    return { ok: true, email: "dev@bypass.local" };
  }
  const email = await getCurrentUserEmail();
  if (!email) return { ok: false, reason: "unauthorized" };
  if (!isAdminEmail(email)) return { ok: false, reason: "forbidden" };
  return { ok: true, email };
}
