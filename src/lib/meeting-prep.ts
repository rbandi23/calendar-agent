import { getEvent } from "@/lib/calendar-service";
import { searchMessages } from "@/lib/gmail-service";
import type { MeetingPrepData } from "@/types";

/**
 * Prepare context for an upcoming meeting.
 * Fetches event details and searches for email threads
 * specifically between the user and the other attendees,
 * focused around the meeting date.
 */
export async function prepareMeetingContext(
  accessToken: string,
  eventId: string,
  userEmail?: string
): Promise<MeetingPrepData> {
  const event = await getEvent(accessToken, eventId);

  // Get other attendees only (exclude user)
  const allEmails = event.attendees?.map((a) => a.email) ?? [];
  const otherEmails = userEmail
    ? allEmails.filter((e) => e !== userEmail)
    : allEmails;

  // Search window: 2 weeks before the meeting date
  const meetingDate = event.start.dateTime
    ? new Date(event.start.dateTime)
    : event.start.date
      ? new Date(event.start.date)
      : new Date();

  const searchStart = new Date(meetingDate);
  searchStart.setDate(searchStart.getDate() - 14);

  const afterFilter = `after:${searchStart.toISOString().slice(0, 10)}`;
  const beforeFilter = `before:${new Date(meetingDate.getTime() + 86400000).toISOString().slice(0, 10)}`;

  let recentEmails: MeetingPrepData["recentEmails"] = [];
  if (otherEmails.length > 0) {
    // For each attendee, search for direct email exchanges
    for (const email of otherEmails.slice(0, 3)) {
      try {
        const results = await searchMessages(
          accessToken,
          `{from:${email}} OR {to:${email}} ${afterFilter} ${beforeFilter}`,
          5
        );
        recentEmails.push(...results);
      } catch {
        // Continue with other attendees
      }
    }

    // Deduplicate by threadId
    const seenThreads = new Set<string>();
    recentEmails = recentEmails.filter((email) => {
      if (seenThreads.has(email.threadId)) return false;
      seenThreads.add(email.threadId);
      return true;
    });

    // Keep top 5
    recentEmails = recentEmails.slice(0, 5);
  }

  const notes = event.description?.trim() || "";

  const suggestedActions: string[] = [];
  if (otherEmails.length > 0) suggestedActions.push("Email attendees");
  if (!notes) suggestedActions.push("Add agenda notes");

  // Build a useful summary for GPT to work with
  const attendeeNames = otherEmails.join(", ");
  let summary = `Meeting: "${event.summary}" with ${attendeeNames}.`;
  if (notes) summary += ` Agenda/notes: ${notes}`;
  if (recentEmails.length > 0) {
    summary += ` Recent email context: ${recentEmails.map((e) => `"${e.subject}" (${e.date})`).join("; ")}.`;
  } else {
    summary += " No recent email threads found with attendees.";
  }

  return {
    event,
    recentEmails,
    suggestedActions,
    summary,
  };
}
