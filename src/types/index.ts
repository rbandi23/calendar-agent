export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Attendee[];
  organizer?: { email: string; displayName?: string; self?: boolean };
  location?: string;
  status?: string;
  htmlLink?: string;
  colorId?: string;
  recurringEventId?: string;
}

export interface Attendee {
  email: string;
  displayName?: string;
  responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
  self?: boolean;
  organizer?: boolean;
}

export interface FreeBusyResponse {
  calendars: Record<string, { busy: { start: string; end: string }[] }>;
}

export interface TimeSlot {
  start: string;
  end: string;
  label?: string;
  reason?: string;
}

export interface EmailThread {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body?: string;
}

export interface EmailDraft {
  id: string;
  to: string;
  subject: string;
  body: string;
}

export interface Contact {
  resourceName: string;
  name: string;
  email: string;
  photoUrl?: string;
}

export interface ToolCallStatus {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "pending" | "done" | "error";
  summary?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  structuredBlocks?: StructuredBlock[];
  toolCalls?: ToolCallStatus[];
  authError?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type StructuredBlock =
  | { type: "timeslots"; data: TimeSlot[] }
  | { type: "draft"; data: EmailDraft }
  | { type: "analytics"; data: AnalyticsData }
  | { type: "meetingprep"; data: MeetingPrepData };

export interface AnalyticsData {
  totalHours: number;
  meetingCount: number;
  byDay: { day: string; hours: number }[];
  recurringHours: number;
  oneOffHours: number;
  focusTimeAvailable: number;
  recommendations: string[];
}

export interface MeetingPrepData {
  event: CalendarEvent;
  recentEmails: EmailThread[];
  suggestedActions: string[];
  summary?: string;
}

export interface UserPreferences {
  workHoursStart: string;
  workHoursEnd: string;
  morningProtection: string;
  bufferMinutes: number;
  maxMeetingHoursPerDay: number;
  defaultMeetingDuration: number;
  focusBlockDuration: number;
  timezone: string;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  workHoursStart: "09:00",
  workHoursEnd: "17:00",
  morningProtection: "10:00",
  bufferMinutes: 10,
  maxMeetingHoursPerDay: 6,
  defaultMeetingDuration: 30,
  focusBlockDuration: 120,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export type ContextPanelState =
  | { mode: "empty" }
  | { mode: "event"; eventId: string }
  | { mode: "scheduling"; attendees: string[]; duration: number }
  | { mode: "draft"; draft: EmailDraft };

export type CenterView = "calendar" | "chat";

export type CalendarTab = "week" | "month";
