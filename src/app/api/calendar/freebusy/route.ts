import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, AuthTokenExpiredError } from "@/lib/auth";
import { getFreeBusy } from "@/lib/calendar-service";

/**
 * POST /api/calendar/freebusy
 * Body: { timeMin, timeMax, attendees?: string[] }
 * Returns free/busy information for the given calendars.
 */
export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    const body = await request.json();

    const { timeMin, timeMax, attendees } = body;

    if (!timeMin || !timeMax) {
      return NextResponse.json(
        { error: "timeMin and timeMax are required" },
        { status: 400 }
      );
    }

    const calendarIds =
      attendees && attendees.length > 0 ? attendees : ["primary"];

    const freeBusy = await getFreeBusy(
      accessToken,
      timeMin,
      timeMax,
      calendarIds
    );

    return NextResponse.json({ freeBusy });
  } catch (error) {
    if (error instanceof AuthTokenExpiredError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("POST /api/calendar/freebusy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch free/busy data" },
      { status: 500 }
    );
  }
}
