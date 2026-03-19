import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, AuthTokenExpiredError } from "@/lib/auth";
import { getEvent, updateEvent, deleteEvent } from "@/lib/calendar-service";

type RouteContext = { params: Promise<{ eventId: string }> };

/**
 * GET /api/calendar/[eventId]
 * Get a single calendar event.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const accessToken = await getAccessToken();
    const { eventId } = await context.params;
    const event = await getEvent(accessToken, eventId);
    return NextResponse.json({ event });
  } catch (error) {
    if (error instanceof AuthTokenExpiredError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("GET /api/calendar/[eventId] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/calendar/[eventId]
 * Update a calendar event (partial update).
 * Body: partial event fields (summary, description, start, end, attendees, location, status, colorId)
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const accessToken = await getAccessToken();
    const { eventId } = await context.params;
    const updates = await request.json();

    const event = await updateEvent(accessToken, eventId, updates);
    return NextResponse.json({ event });
  } catch (error) {
    if (error instanceof AuthTokenExpiredError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("PATCH /api/calendar/[eventId] error:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/calendar/[eventId]
 * Delete a calendar event.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const accessToken = await getAccessToken();
    const { eventId } = await context.params;

    await deleteEvent(accessToken, eventId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthTokenExpiredError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("DELETE /api/calendar/[eventId] error:", error);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}
