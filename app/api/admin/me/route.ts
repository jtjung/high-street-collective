import { NextResponse } from "next/server";
import { getAuth } from "@/lib/get-auth";
import { getCurrentUserEmail, isAdminEmail } from "@/lib/admin";

// Lightweight probe: returns { isAdmin } for the current user so the
// client nav can decide whether to show the Admin tab. Never 401s —
// falls back to `{ isAdmin: false }` when signed out so the nav tabs
// never have to special-case anonymous/guest state.
export async function GET() {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ isAdmin: false });
  try {
    const email = await getCurrentUserEmail();
    return NextResponse.json({ isAdmin: isAdminEmail(email) });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
