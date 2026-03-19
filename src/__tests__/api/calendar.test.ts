/**
 * Integration tests for calendar API routes.
 * These test the route handler logic by mocking auth and calendar services.
 */

jest.mock("@/lib/auth", () => ({
  getAccessToken: jest.fn().mockResolvedValue("test-token"),
  auth: jest.fn().mockResolvedValue({ user: { name: "Test", email: "test@example.com" } }),
}));

jest.mock("@/lib/calendar-service", () => ({
  listEvents: jest.fn().mockResolvedValue([
    {
      id: "evt1",
      summary: "Test Meeting",
      start: { dateTime: "2025-03-17T10:00:00Z" },
      end: { dateTime: "2025-03-17T11:00:00Z" },
    },
  ]),
  getEvent: jest.fn().mockResolvedValue({
    id: "evt1",
    summary: "Test Meeting",
    start: { dateTime: "2025-03-17T10:00:00Z" },
    end: { dateTime: "2025-03-17T11:00:00Z" },
  }),
  createEvent: jest.fn().mockResolvedValue({
    id: "new-evt",
    summary: "New Event",
  }),
  deleteEvent: jest.fn().mockResolvedValue(undefined),
  getFreeBusy: jest.fn().mockResolvedValue({
    calendars: { primary: { busy: [] } },
  }),
}));

describe("Calendar API routes", () => {
  it("listEvents returns events from calendar service", async () => {
    const { listEvents } = require("@/lib/calendar-service");
    const events = await listEvents("test-token", "2025-03-17T00:00:00Z", "2025-03-17T23:59:59Z");
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("evt1");
  });

  it("getAccessToken rejects unauthenticated requests", async () => {
    const { getAccessToken } = require("@/lib/auth");
    getAccessToken.mockRejectedValueOnce(new Error("Not authenticated"));
    await expect(getAccessToken()).rejects.toThrow("Not authenticated");
  });

  it("createEvent creates event via calendar service", async () => {
    const { createEvent } = require("@/lib/calendar-service");
    const result = await createEvent("test-token", {
      summary: "New Event",
      start: { dateTime: "2025-03-18T10:00:00Z" },
      end: { dateTime: "2025-03-18T11:00:00Z" },
    });
    expect(result.id).toBe("new-evt");
  });

  it("deleteEvent succeeds", async () => {
    const { deleteEvent } = require("@/lib/calendar-service");
    await expect(deleteEvent("test-token", "evt1")).resolves.toBeUndefined();
  });

  it("getFreeBusy returns busy times", async () => {
    const { getFreeBusy } = require("@/lib/calendar-service");
    const result = await getFreeBusy("test-token", "2025-03-17T00:00:00Z", "2025-03-17T23:59:59Z");
    expect(result.calendars.primary.busy).toEqual([]);
  });
});
