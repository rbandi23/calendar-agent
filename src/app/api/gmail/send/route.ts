import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, AuthTokenExpiredError } from "@/lib/auth";
import { sendMessage } from "@/lib/gmail-service";

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const MAX_BODY_LENGTH = 100_000;
const MAX_SUBJECT_LENGTH = 998; // RFC 2822 line length limit

function validateEmails(raw: string): string[] | null {
  const addresses = raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (addresses.length === 0) return null;
  for (const addr of addresses) {
    if (!EMAIL_RE.test(addr) || addr.includes("\n") || addr.includes("\r")) {
      return null;
    }
  }
  return addresses;
}

/**
 * POST /api/gmail/send
 * Body: { to, subject, body }
 * Sends an email via Gmail. Called only from the UI after explicit user action.
 */
export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();

    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 }
      );
    }

    const { to, subject, body } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: "to, subject, and body are required" },
        { status: 400 }
      );
    }

    if (typeof to !== "string" || typeof subject !== "string" || typeof body !== "string") {
      return NextResponse.json(
        { error: "to, subject, and body must be strings" },
        { status: 400 }
      );
    }

    const validatedEmails = validateEmails(to);
    if (!validatedEmails) {
      return NextResponse.json(
        { error: "Invalid email address format in 'to' field" },
        { status: 400 }
      );
    }

    if (subject.length > MAX_SUBJECT_LENGTH) {
      return NextResponse.json(
        { error: `Subject must be ${MAX_SUBJECT_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    if (body.length > MAX_BODY_LENGTH) {
      return NextResponse.json(
        { error: `Body must be ${MAX_BODY_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    // Reject newlines in subject to prevent header injection
    if (/[\r\n]/.test(subject)) {
      return NextResponse.json(
        { error: "Subject must not contain newlines" },
        { status: 400 }
      );
    }

    const sanitizedTo = validatedEmails.join(", ");
    const result = await sendMessage(accessToken, sanitizedTo, subject, body);
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof AuthTokenExpiredError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("POST /api/gmail/send error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
