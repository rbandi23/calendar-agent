import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, AuthTokenExpiredError } from "@/lib/auth";
import { listEvents } from "@/lib/calendar-service";
import { computeAnalytics } from "@/lib/analytics";
import { DEFAULT_PREFERENCES } from "@/types";

/**
 * GET /api/analytics?timeMin=...&timeMax=...
 * Fetch calendar events for the range and compute analytics.
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    const { searchParams } = request.nextUrl;

    const timeMin =
      searchParams.get("timeMin") ??
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax =
      searchParams.get("timeMax") ?? new Date().toISOString();

    const events = await listEvents(accessToken, timeMin, timeMax);
    const analytics = computeAnalytics(events, DEFAULT_PREFERENCES);

    return NextResponse.json({ analytics });
  } catch (error) {
    if (error instanceof AuthTokenExpiredError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("GET /api/analytics error:", error);
    return NextResponse.json(
      { error: "Failed to compute analytics" },
      { status: 500 }
    );
  }
}
