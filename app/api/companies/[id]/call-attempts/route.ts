import { auth, clerkClient } from "@clerk/nextjs/server";
import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("call_attempts")
    .select("*")
    .eq("company_id", id)
    .order("ts", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ attempts: data ?? [] });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let email: string | null = null;
  let name: string | null = null;
  if (process.env.AUTH_BYPASS !== "true") {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    email = user.primaryEmailAddress?.emailAddress ?? null;
    name = user.firstName
      ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
      : email?.split("@")[0] ?? null;
  } else {
    email = "dev@bypass.local";
    name = "Dev User";
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("call_attempts")
    .insert({
      company_id: id,
      user_id: userId,
      user_email: email,
      user_name: name,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
