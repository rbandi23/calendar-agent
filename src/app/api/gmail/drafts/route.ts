import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, AuthTokenExpiredError } from "@/lib/auth";
import { createDraft } from "@/lib/gmail-service";

/**
 * POST /api/gmail/drafts
 * Body: { to, subject, body }
 * Creates a Gmail draft (does NOT send it).
 */
export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    const { to, subject, body } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: "to, subject, and body are required" },
        { status: 400 }
      );
    }

    const draft = await createDraft(accessToken, to, subject, body);
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthTokenExpiredError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("POST /api/gmail/drafts error:", error);
    return NextResponse.json(
      { error: "Failed to create draft" },
      { status: 500 }
    );
  }
}
