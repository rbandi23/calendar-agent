import { getGmailClient } from "@/lib/google";
import type { EmailThread, EmailDraft } from "@/types";

/**
 * Encode a string to URL-safe base64 (RFC 4648 section 5).
 */
function toBase64Url(str: string): string {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decode a base64url-encoded string.
 */
function fromBase64Url(b64: string): string {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf-8");
}

/**
 * RFC 2047 encode a header value if it contains non-ASCII characters.
 * Uses Base64 encoding: =?UTF-8?B?<base64>?=
 */
function encodeHeaderValue(value: string): string {
  // Check if the string has any non-ASCII characters
  if (/^[\x20-\x7E]*$/.test(value)) {
    return value; // Pure ASCII — no encoding needed
  }
  const encoded = Buffer.from(value, "utf-8").toString("base64");
  return `=?UTF-8?B?${encoded}?=`;
}

/**
 * Build a raw RFC 2822 message string with proper MIME encoding.
 * Handles Unicode in subject lines and body text.
 */
function buildRawMessage(to: string, subject: string, body: string): string {
  const bodyBase64 = Buffer.from(body, "utf-8").toString("base64");
  const lines = [
    `MIME-Version: 1.0`,
    `To: ${to}`,
    `Subject: ${encodeHeaderValue(subject)}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    "",
    bodyBase64,
  ];
  return toBase64Url(lines.join("\r\n"));
}

/**
 * Extract header value from a Gmail message payload.
 */
function getHeader(
  headers: { name?: string | null; value?: string | null }[],
  name: string
): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/**
 * Extract the plain-text body from a Gmail message payload.
 */
function extractBody(payload: {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: {
    mimeType?: string | null;
    body?: { data?: string | null } | null;
    parts?: {
      mimeType?: string | null;
      body?: { data?: string | null } | null;
    }[];
  }[];
}): string {
  // Simple message (no parts)
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return fromBase64Url(payload.body.data);
  }

  // Multipart — recurse into parts
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return fromBase64Url(part.body.data);
      }
      // Nested multipart (e.g. multipart/alternative inside multipart/mixed)
      if (part.parts) {
        for (const sub of part.parts) {
          if (sub.mimeType === "text/plain" && sub.body?.data) {
            return fromBase64Url(sub.body.data);
          }
        }
      }
    }
  }

  return "";
}

/**
 * Search Gmail messages. Returns lightweight message metadata.
 */
export async function searchMessages(
  accessToken: string,
  query: string,
  maxResults = 10
): Promise<EmailThread[]> {
  const gmail = getGmailClient(accessToken);
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const messageIds = listRes.data.messages ?? [];
  const results: EmailThread[] = [];

  for (const msg of messageIds) {
    if (!msg.id) continue;
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "To", "Date"],
    });

    const headers = detail.data.payload?.headers ?? [];
    results.push({
      id: msg.id,
      threadId: detail.data.threadId ?? msg.id,
      snippet: detail.data.snippet ?? "",
      subject: getHeader(headers, "Subject"),
      from: getHeader(headers, "From"),
      to: getHeader(headers, "To"),
      date: getHeader(headers, "Date"),
    });
  }

  return results;
}

/**
 * Get a full message by ID, including the decoded body.
 */
export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<EmailThread> {
  const gmail = getGmailClient(accessToken);
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = res.data.payload?.headers ?? [];
  const body = res.data.payload ? extractBody(res.data.payload) : "";

  return {
    id: res.data.id ?? messageId,
    threadId: res.data.threadId ?? messageId,
    snippet: res.data.snippet ?? "",
    subject: getHeader(headers, "Subject"),
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    date: getHeader(headers, "Date"),
    body,
  };
}

/**
 * Get all messages in a thread.
 */
export async function getThread(
  accessToken: string,
  threadId: string
): Promise<EmailThread[]> {
  const gmail = getGmailClient(accessToken);
  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  const messages = res.data.messages ?? [];
  return messages.map((msg) => {
    const headers = msg.payload?.headers ?? [];
    const body = msg.payload ? extractBody(msg.payload) : "";
    return {
      id: msg.id ?? "",
      threadId: res.data.id ?? threadId,
      snippet: msg.snippet ?? "",
      subject: getHeader(headers, "Subject"),
      from: getHeader(headers, "From"),
      to: getHeader(headers, "To"),
      date: getHeader(headers, "Date"),
      body,
    };
  });
}

/**
 * Create an email draft. Returns the draft metadata.
 */
export async function createDraft(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<EmailDraft> {
  const gmail = getGmailClient(accessToken);
  const raw = buildRawMessage(to, subject, body);

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });

  return {
    id: res.data.id ?? "",
    to,
    subject,
    body,
  };
}

/**
 * Send an existing draft by its draft ID.
 */
export async function sendDraft(
  accessToken: string,
  draftId: string
): Promise<{ id: string; threadId: string }> {
  const gmail = getGmailClient(accessToken);
  const res = await gmail.users.drafts.send({
    userId: "me",
    requestBody: { id: draftId },
  });

  return {
    id: res.data.id ?? "",
    threadId: res.data.threadId ?? "",
  };
}

/**
 * Send an email directly (without creating a draft first).
 */
export async function sendMessage(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<{ id: string; threadId: string }> {
  const gmail = getGmailClient(accessToken);
  const raw = buildRawMessage(to, subject, body);

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return {
    id: res.data.id ?? "",
    threadId: res.data.threadId ?? "",
  };
}
