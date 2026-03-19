import { getCalendarClient } from "@/lib/google";
import type { CalendarEvent, FreeBusyResponse } from "@/types";

/**
 * List calendar events within a time range.
 */
export async function listEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
  calendarId = "primary",
  maxResults = 250
): Promise<CalendarEvent[]> {
  const calendar = getCalendarClient(accessToken);
  const res = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });
  return (res.data.items ?? []) as CalendarEvent[];
}

/**
 * Get a single event by ID.
 */
export async function getEvent(
  accessToken: string,
  eventId: string,
  calendarId = "primary"
): Promise<CalendarEvent> {
  const calendar = getCalendarClient(accessToken);
  const res = await calendar.events.get({ calendarId, eventId });
  return res.data as CalendarEvent;
}

/**
 * Create a new calendar event.
 */
export async function createEvent(
  accessToken: string,
  event: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    attendees?: { email: string }[];
    location?: string;
  },
  calendarId = "primary"
): Promise<CalendarEvent> {
  const calendar = getCalendarClient(accessToken);
  const res = await calendar.events.insert({
    calendarId,
    requestBody: event,
    sendUpdates: "all",
  });
  return res.data as CalendarEvent;
}

/**
 * Update an existing calendar event (partial update / patch).
 */
export async function updateEvent(
  accessToken: string,
  eventId: string,
  updates: Partial<{
    summary: string;
    description: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    attendees: { email: string }[];
    location: string;
    status: string;
    colorId: string;
  }>,
  calendarId = "primary"
): Promise<CalendarEvent> {
  const calendar = getCalendarClient(accessToken);
  const res = await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: updates,
    sendUpdates: "all",
  });
  return res.data as CalendarEvent;
}

/**
 * Delete a calendar event.
 */
export async function deleteEvent(
  accessToken: string,
  eventId: string,
  calendarId = "primary"
): Promise<void> {
  const calendar = getCalendarClient(accessToken);
  await calendar.events.delete({
    calendarId,
    eventId,
    sendUpdates: "all",
  });
}

/**
 * Query free/busy information for one or more calendars.
 */
export async function getFreeBusy(
  accessToken: string,
  timeMin: string,
  timeMax: string,
  calendarIds: string[] = ["primary"]
): Promise<FreeBusyResponse> {
  const calendar = getCalendarClient(accessToken);
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: calendarIds.map((id) => ({ id })),
    },
  });
  return res.data as unknown as FreeBusyResponse;
}
