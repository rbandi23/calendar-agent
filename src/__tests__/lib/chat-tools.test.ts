import { executeTool } from "@/lib/chat-tools";
import type { UserPreferences } from "@/types";

// Mock all service modules
jest.mock("@/lib/calendar-service", () => ({
  listEvents: jest.fn().mockResolvedValue([
    { id: "e1", summary: "Test", start: { dateTime: "2025-03-17T10:00:00Z" }, end: { dateTime: "2025-03-17T11:00:00Z" } },
  ]),
  getEvent: jest.fn().mockResolvedValue({
    id: "e1",
    summary: "Test",
    start: { dateTime: "2025-03-17T10:00:00Z" },
    end: { dateTime: "2025-03-17T11:00:00Z" },
  }),
  createEvent: jest.fn().mockResolvedValue({ id: "new-e", summary: "Created" }),
  getFreeBusy: jest.fn().mockResolvedValue({ calendars: { primary: { busy: [] } } }),
}));

jest.mock("@/lib/gmail-service", () => ({
  searchMessages: jest.fn().mockResolvedValue([{ id: "m1", subject: "Hello" }]),
}));

jest.mock("@/lib/contacts-service", () => ({
  searchContacts: jest.fn().mockResolvedValue([{ name: "Alice", email: "alice@test.com" }]),
}));

jest.mock("@/lib/analytics", () => ({
  computeAnalytics: jest.fn().mockReturnValue({
    totalHours: 5, meetingCount: 3, byDay: [], recurringHours: 2, oneOffHours: 3, focusTimeAvailable: 3, recommendations: [],
  }),
}));

jest.mock("@/lib/meeting-prep", () => ({
  prepareMeetingContext: jest.fn().mockResolvedValue({
    event: { id: "e1", summary: "Test" },
    recentEmails: [],
    suggestedActions: ["Email attendees"],
    summary: "Meeting prep ready",
  }),
}));

const token = "test-token";
const prefs: UserPreferences = {
  workHoursStart: "09:00",
  workHoursEnd: "17:00",
  morningProtection: "10:00",
  bufferMinutes: 10,
  maxMeetingHoursPerDay: 6,
  defaultMeetingDuration: 30,
  focusBlockDuration: 120,
  timezone: "America/New_York",
};

describe("executeTool", () => {
  it("dispatches list_calendar_events", async () => {
    const result = await executeTool("list_calendar_events", { timeMin: "2025-03-17T00:00:00Z", timeMax: "2025-03-17T23:59:59Z" }, token, prefs);
    expect(Array.isArray(result)).toBe(true);
  });

  it("dispatches get_event_details", async () => {
    const result = await executeTool("get_event_details", { eventId: "e1" }, token, prefs) as { id: string };
    expect(result.id).toBe("e1");
  });

  it("dispatches create_calendar_event", async () => {
    const result = await executeTool("create_calendar_event", {
      summary: "New", startDateTime: "2025-03-18T14:00:00Z", endDateTime: "2025-03-18T15:00:00Z",
    }, token, prefs) as { id: string };
    expect(result.id).toBe("new-e");
  });

  it("dispatches get_free_busy", async () => {
    const result = await executeTool("get_free_busy", { timeMin: "2025-03-17T00:00:00Z", timeMax: "2025-03-17T23:59:59Z" }, token, prefs);
    expect(result).toBeDefined();
  });

  it("dispatches search_emails", async () => {
    const result = await executeTool("search_emails", { query: "test" }, token, prefs);
    expect(Array.isArray(result)).toBe(true);
  });

  it("dispatches propose_email (returns draft data without calling Gmail)", async () => {
    const result = await executeTool("propose_email", { to: "a@b.com", subject: "Hi", body: "Hello" }, token, prefs) as { to: string; subject: string; body: string };
    expect(result.to).toBe("a@b.com");
    expect(result.subject).toBe("Hi");
    expect(result.body).toBe("Hello");
  });

  it("dispatches search_contacts", async () => {
    const result = await executeTool("search_contacts", { query: "alice" }, token, prefs);
    expect(Array.isArray(result)).toBe(true);
  });

  it("dispatches analyze_meeting_time", async () => {
    const result = await executeTool("analyze_meeting_time", { timeMin: "2025-03-17T00:00:00Z", timeMax: "2025-03-17T23:59:59Z" }, token, prefs) as { totalHours: number };
    expect(result.totalHours).toBe(5);
  });

  it("dispatches get_user_preferences", async () => {
    const result = await executeTool("get_user_preferences", {}, token, prefs);
    expect(result).toEqual(prefs);
  });

  it("dispatches prep_for_meeting", async () => {
    const result = await executeTool("prep_for_meeting", { eventId: "e1" }, token, prefs) as { summary: string };
    expect(result.summary).toBe("Meeting prep ready");
  });

  it("throws for unknown tool", async () => {
    await expect(executeTool("nonexistent_tool", {}, token, prefs)).rejects.toThrow("Unknown tool");
  });
});
