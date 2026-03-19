import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, AuthTokenExpiredError } from "@/lib/auth";
import { searchMessages } from "@/lib/gmail-service";

/**
 * GET /api/gmail?q=...&maxResults=...
 * Search Gmail messages using a query string.
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    const { searchParams } = request.nextUrl;

    const query = searchParams.get("q") ?? "in:inbox";
    const maxResults = parseInt(searchParams.get("maxResults") ?? "10", 10);

    const messages = await searchMessages(accessToken, query, maxResults);
    return NextResponse.json({ messages });
  } catch (error) {
    if (error instanceof AuthTokenExpiredError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("GET /api/gmail error:", error);
    return NextResponse.json(
      { error: "Failed to search emails" },
      { status: 500 }
    );
  }
}
