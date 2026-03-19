import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, AuthTokenExpiredError } from "@/lib/auth";
import { searchContacts } from "@/lib/contacts-service";

/**
 * GET /api/contacts?q=...
 * Search Google Contacts by name or email.
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    const { searchParams } = request.nextUrl;

    const query = searchParams.get("q");
    if (!query) {
      return NextResponse.json(
        { error: "q query parameter is required" },
        { status: 400 }
      );
    }

    const contacts = await searchContacts(accessToken, query);
    return NextResponse.json({ contacts });
  } catch (error) {
    if (error instanceof AuthTokenExpiredError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("GET /api/contacts error:", error);
    return NextResponse.json(
      { error: "Failed to search contacts" },
      { status: 500 }
    );
  }
}
