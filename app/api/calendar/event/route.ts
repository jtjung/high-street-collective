import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { TEAM_MEMBERS } from "@/config/team";
import { addMinutes } from "date-fns";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyName, phone, address, startTime: startTimeStr } =
    (await request.json()) as {
      companyName: string;
      phone?: string | null;
      address?: string | null;
      startTime: string;
    };

  if (!startTimeStr) {
    return NextResponse.json(
      { error: "startTime is required" },
      { status: 400 }
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
    const endTime = addMinutes(startTime, 15);

    const event = {
      summary: `Callback: ${companyName}`,
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
