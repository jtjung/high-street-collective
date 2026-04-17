import { clerkClient } from "@clerk/nextjs/server";
import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { TEAM_MEMBERS } from "@/config/team";
import { addMinutes } from "date-fns";

export async function POST(request: Request) {
  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyName, phone, address, startTime: startTimeStr, durationMinutes, summary: customSummary } =
    (await request.json()) as {
      companyName: string;
      phone?: string | null;
      address?: string | null;
      startTime: string;
      durationMinutes?: number;
      summary?: string;
    };

  if (!startTimeStr) {
    return NextResponse.json(
      { error: "startTime is required" },
      { status: 400 }
    );
  }

  if (process.env.AUTH_BYPASS === "true") {
    return NextResponse.json(
      { error: "Calendar integration not available in preview mode" },
      { status: 503 }
    );
  }

  try {
    // Get Google OAuth token from Clerk
    const client = await clerkClient();
    const tokenResponse = await client.users.getUserOauthAccessToken(
      userId,
      "google"
    );
    const oauthTokens = tokenResponse.data;

    if (!oauthTokens || oauthTokens.length === 0) {
      return NextResponse.json(
        { error: "No Google OAuth token found. Please re-authenticate with Google." },
        { status: 401 }
      );
    }

    const accessToken = oauthTokens[0].token;
    const scopes = oauthTokens[0].scopes ?? [];

    if (!scopes.some((s) => s.includes("calendar"))) {
      return NextResponse.json(
        {
          error:
            "Google OAuth token is missing the calendar scope. Sign out and sign back in with Google, and approve the calendar permission.",
          scopesGranted: scopes,
        },
        { status: 403 }
      );
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const startTime = new Date(startTimeStr);
    const endTime = addMinutes(startTime, durationMinutes ?? 15);

    const event = {
      summary: customSummary ?? `Callback: ${companyName}`,
      description: [
        `Phone: ${phone || "N/A"}`,
        `Address: ${address || "N/A"}`,
      ].join("\n"),
      start: {
        dateTime: startTime.toISOString(),
        timeZone: "Europe/London",
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: "Europe/London",
      },
      attendees: TEAM_MEMBERS.map((m) => ({ email: m.email })),
    };

    const result = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
      sendUpdates: "all",
    });

    return NextResponse.json({
      eventId: result.data.id,
      htmlLink: result.data.htmlLink,
    });
  } catch (error) {
    console.error("Calendar API error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create calendar event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getOAuth2Client(userId: string) {
  if (process.env.AUTH_BYPASS === "true") return null;
  const client = await clerkClient();
  const tokenResponse = await client.users.getUserOauthAccessToken(userId, "google");
  const token = tokenResponse.data?.[0];
  if (!token) return null;
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: token.token });
  return oauth2Client;
}

export async function PATCH(request: Request) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId, companyName, phone, address, startTime: startTimeStr, durationMinutes } =
    (await request.json()) as {
      eventId: string;
      companyName?: string;
      phone?: string | null;
      address?: string | null;
      startTime: string;
      durationMinutes?: number;
    };

  if (!eventId || !startTimeStr) {
    return NextResponse.json({ error: "eventId and startTime are required" }, { status: 400 });
  }

  if (process.env.AUTH_BYPASS === "true") {
    return NextResponse.json({ error: "Calendar integration not available in preview mode" }, { status: 503 });
  }

  try {
    const oauth2Client = await getOAuth2Client(userId);
    if (!oauth2Client) {
      return NextResponse.json({ error: "No Google OAuth token found" }, { status: 401 });
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const startTime = new Date(startTimeStr);
    const endTime = addMinutes(startTime, durationMinutes ?? 15);

    const patch: Record<string, unknown> = {
      start: { dateTime: startTime.toISOString(), timeZone: "Europe/London" },
      end: { dateTime: endTime.toISOString(), timeZone: "Europe/London" },
    };
    if (companyName) patch.summary = `Callback: ${companyName}`;
    if (phone !== undefined || address !== undefined) {
      patch.description = [`Phone: ${phone || "N/A"}`, `Address: ${address || "N/A"}`].join("\n");
    }

    const result = await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: patch,
      sendUpdates: "all",
    });

    return NextResponse.json({ eventId: result.data.id, htmlLink: result.data.htmlLink });
  } catch (error) {
    console.error("Calendar PATCH error:", error);
    const message = error instanceof Error ? error.message : "Failed to update calendar event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json({ error: "eventId query param is required" }, { status: 400 });
  }

  if (process.env.AUTH_BYPASS === "true") {
    return NextResponse.json({ error: "Calendar integration not available in preview mode" }, { status: 503 });
  }

  try {
    const oauth2Client = await getOAuth2Client(userId);
    if (!oauth2Client) {
      return NextResponse.json({ error: "No Google OAuth token found" }, { status: 401 });
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
      sendUpdates: "all",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Calendar DELETE error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete calendar event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
