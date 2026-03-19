import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, AuthTokenExpiredError } from "@/lib/auth";
import { listEvents, createEvent } from "@/lib/calendar-service";

/**
 * GET /api/calendar?timeMin=...&timeMax=...
 * List calendar events within a time range.
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    const { searchParams } = request.nextUrl;

    const timeMin =
      searchParams.get("timeMin") ?? new Date().toISOString();
    const timeMax =
      searchParams.get("timeMax") ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const events = await listEvents(accessToken, timeMin, timeMax);
    return NextResponse.json({ events });
  } catch (error) {
    if (error instanceof AuthTokenExpiredError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("GET /api/calendar error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendar
 * Create a new calendar event.
 * Body: { summary, description?, start, end, attendees?, location? }
 */
export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    const body = await request.json();

    const { summary, description, start, end, attendees, location } = body;

    if (!summary || !start || !end) {
      return NextResponse.json(
        { error: "summary, start, and end are required" },
        { status: 400 }
      );
    }

    const event = await createEvent(accessToken, {
      summary,
      description,
      start,
      end,
      attendees,
      location,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthTokenExpiredError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("POST /api/calendar error:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
