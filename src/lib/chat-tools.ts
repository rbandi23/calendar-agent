import type OpenAI from "openai";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getFreeBusy,
} from "@/lib/calendar-service";
import { searchMessages } from "@/lib/gmail-service";
import { searchContacts } from "@/lib/contacts-service";
import { computeAnalytics } from "@/lib/analytics";
import { prepareMeetingContext } from "@/lib/meeting-prep";
import type { UserPreferences } from "@/types";
import { DEFAULT_PREFERENCES } from "@/types";

// ---------------------------------------------------------------------------
// Tool definitions (OpenAI function-calling format)
// ---------------------------------------------------------------------------

export const chatTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description:
        "List calendar events within a date/time range. Returns event summaries, times, attendees, and links.",
      parameters: {
        type: "object",
        properties: {
          timeMin: {
            type: "string",
            description: "Start of range in ISO 8601 format (e.g. 2025-03-17T00:00:00Z)",
          },
          timeMax: {
            type: "string",
            description: "End of range in ISO 8601 format",
          },
        },
        required: ["timeMin", "timeMax"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_event_details",
      description:
        "Get full details of a specific calendar event by its ID, including description, attendees, and location.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "The Google Calendar event ID",
          },
        },
        required: ["eventId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description:
        "Create a new calendar event with a title, start/end time, optional description, attendees, and location.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Event title" },
          description: { type: "string", description: "Event description" },
          startDateTime: {
            type: "string",
            description: "Start time in ISO 8601 format",
          },
          endDateTime: {
            type: "string",
            description: "End time in ISO 8601 format",
          },
          timeZone: {
            type: "string",
            description: "IANA timezone (e.g. America/New_York)",
          },
          attendees: {
            type: "array",
            items: { type: "string" },
            description: "List of attendee email addresses",
          },
          location: { type: "string", description: "Event location" },
        },
        required: ["summary", "startDateTime", "endDateTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_free_busy",
      description:
        "Check free/busy availability for one or more calendars within a time range. Useful for finding open slots.",
      parameters: {
        type: "object",
        properties: {
          timeMin: {
            type: "string",
            description: "Start of range in ISO 8601 format",
          },
          timeMax: {
            type: "string",
            description: "End of range in ISO 8601 format",
          },
          attendees: {
            type: "array",
            items: { type: "string" },
            description:
              "Email addresses to check availability for. If empty, checks the user's own calendar.",
          },
        },
        required: ["timeMin", "timeMax"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_emails",
      description:
        "Search Gmail messages using a query string (same syntax as Gmail search bar). Returns subject, from, date, and snippet.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Gmail search query (e.g. 'from:boss@company.com subject:quarterly')",
          },
          maxResults: {
            type: "number",
            description: "Maximum number of results (default 10)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_email",
      description:
        "Propose an email draft for the user to review and edit before sending. NEVER send emails directly — always propose for user approval. Returns the draft data as an interactive card in the chat. Call this MULTIPLE TIMES to create separate drafts for different recipients.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address(es), comma-separated for a single group email" },
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Email body text" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_contacts",
      description:
        "Search the user's Google Contacts by name or email. Returns names, emails, and photos.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (name or email fragment)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_meeting_time",
      description:
        "Analyze the user's calendar for a given time range and return statistics: total meeting hours, per-day breakdown, recurring vs one-off, focus time, and recommendations.",
      parameters: {
        type: "object",
        properties: {
          timeMin: {
            type: "string",
            description: "Start of analysis range in ISO 8601 format",
          },
          timeMax: {
            type: "string",
            description: "End of analysis range in ISO 8601 format",
          },
        },
        required: ["timeMin", "timeMax"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_preferences",
      description:
        "Get the user's calendar preferences: work hours, buffer time, max meeting hours, timezone, etc.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prep_for_meeting",
      description:
        "Prepare context for an upcoming meeting. Fetches event details, searches for recent email threads with attendees, and extracts notes. Use when the user asks to prep for a meeting.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "The Google Calendar event ID to prep for",
          },
        },
        required: ["eventId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_event",
      description:
        "Reschedule an existing calendar event to a new date/time. Preserves the original duration if only startDateTime is provided. Always confirm with the user before rescheduling. Notifies all attendees of the change.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "The Google Calendar event ID to reschedule",
          },
          startDateTime: {
            type: "string",
            description: "New start time in ISO 8601 format",
          },
          endDateTime: {
            type: "string",
            description: "New end time in ISO 8601 format. If omitted, the original duration is preserved.",
          },
          timeZone: {
            type: "string",
            description: "IANA timezone (e.g. America/New_York)",
          },
        },
        required: ["eventId", "startDateTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_event",
      description:
        "Cancel (delete) a calendar event. Notifies all attendees. Always confirm with the user before cancelling.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "The Google Calendar event ID to cancel",
          },
        },
        required: ["eventId"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool executor
// ---------------------------------------------------------------------------

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  accessToken: string,
  preferences?: UserPreferences,
  userEmail?: string
): Promise<unknown> {
  switch (toolName) {
    case "list_calendar_events": {
      const { timeMin, timeMax } = input as {
        timeMin: string;
        timeMax: string;
      };
      return listEvents(accessToken, timeMin, timeMax);
    }

    case "get_event_details": {
      const { eventId } = input as { eventId: string };
      return getEvent(accessToken, eventId);
    }

    case "create_calendar_event": {
      const {
        summary,
        description,
        startDateTime,
        endDateTime,
        timeZone,
        attendees,
        location,
      } = input as {
        summary: string;
        description?: string;
        startDateTime: string;
        endDateTime: string;
        timeZone?: string;
        attendees?: string[];
        location?: string;
      };

      // Check for conflicts before creating
      const conflicts = await getFreeBusy(accessToken, startDateTime, endDateTime, ["primary"]);
      const primaryBusy = conflicts.calendars?.["primary"]?.busy ?? [];
      if (primaryBusy.length > 0) {
        return {
          warning: "CONFLICT_DETECTED",
          message: `You already have ${primaryBusy.length} event(s) during ${startDateTime} — ${endDateTime}. Ask the user to confirm before proceeding.`,
          conflicts: primaryBusy,
        };
      }

      return createEvent(accessToken, {
        summary,
        description,
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
        attendees: attendees?.map((email) => ({ email })),
        location,
      });
    }

    case "get_free_busy": {
      const { timeMin, timeMax, attendees } = input as {
        timeMin: string;
        timeMax: string;
        attendees?: string[];
      };
      const calendarIds =
        attendees && attendees.length > 0 ? attendees : ["primary"];
      return getFreeBusy(accessToken, timeMin, timeMax, calendarIds);
    }

    case "search_emails": {
      const { query, maxResults } = input as {
        query: string;
        maxResults?: number;
      };
      return searchMessages(accessToken, query, maxResults ?? 10);
    }

    case "propose_email": {
      const { to, subject, body } = input as {
        to: string;
        subject: string;
        body: string;
      };
      // Return the draft data as-is — the chat UI will render it as an editable card
      return { id: "", to, subject, body };
    }

    case "search_contacts": {
      const { query } = input as { query: string };
      return searchContacts(accessToken, query);
    }

    case "analyze_meeting_time": {
      const { timeMin, timeMax } = input as {
        timeMin: string;
        timeMax: string;
      };
      const events = await listEvents(accessToken, timeMin, timeMax);
      const prefs = preferences ?? DEFAULT_PREFERENCES;
      return computeAnalytics(events, prefs);
    }

    case "get_user_preferences": {
      return preferences ?? DEFAULT_PREFERENCES;
    }

    case "prep_for_meeting": {
      const { eventId } = input as { eventId: string };
      return prepareMeetingContext(accessToken, eventId, userEmail);
    }

    case "reschedule_event": {
      const { eventId, startDateTime, endDateTime, timeZone } = input as {
        eventId: string;
        startDateTime: string;
        endDateTime?: string;
        timeZone?: string;
      };

      // If no endDateTime provided, preserve original duration
      let finalEnd = endDateTime;
      if (!finalEnd) {
        const existing = await getEvent(accessToken, eventId);
        const origStart = existing.start.dateTime;
        const origEnd = existing.end.dateTime;
        if (origStart && origEnd) {
          const durationMs = new Date(origEnd).getTime() - new Date(origStart).getTime();
          finalEnd = new Date(new Date(startDateTime).getTime() + durationMs).toISOString();
        } else {
          // Fallback: 30 min
          finalEnd = new Date(new Date(startDateTime).getTime() + 30 * 60 * 1000).toISOString();
        }
      }

      return updateEvent(accessToken, eventId, {
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: finalEnd, timeZone },
      });
    }

    case "cancel_event": {
      const { eventId } = input as { eventId: string };
      await deleteEvent(accessToken, eventId);
      return { success: true, message: "Event cancelled and attendees notified." };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
