import { listEvents, getEvent, createEvent, getFreeBusy } from "@/lib/calendar-service";

// Mock googleapis
jest.mock("@/lib/google", () => ({
  getCalendarClient: jest.fn(() => ({
    events: {
      list: jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: "evt1",
              summary: "Test Meeting",
              start: { dateTime: "2025-03-17T10:00:00Z" },
              end: { dateTime: "2025-03-17T11:00:00Z" },
            },
          ],
        },
      }),
      get: jest.fn().mockResolvedValue({
        data: {
          id: "evt1",
          summary: "Test Meeting",
          start: { dateTime: "2025-03-17T10:00:00Z" },
          end: { dateTime: "2025-03-17T11:00:00Z" },
          attendees: [{ email: "alice@test.com" }],
        },
      }),
      insert: jest.fn().mockResolvedValue({
        data: {
          id: "new-evt",
          summary: "New Meeting",
          start: { dateTime: "2025-03-18T14:00:00Z" },
          end: { dateTime: "2025-03-18T15:00:00Z" },
        },
      }),
    },
    freebusy: {
      query: jest.fn().mockResolvedValue({
        data: {
          calendars: {
            primary: {
              busy: [
                { start: "2025-03-17T10:00:00Z", end: "2025-03-17T11:00:00Z" },
              ],
            },
          },
        },
      }),
    },
  })),
}));

describe("calendar-service", () => {
  const token = "test-token";

  describe("listEvents", () => {
    it("returns events within a time range", async () => {
      const events = await listEvents(token, "2025-03-17T00:00:00Z", "2025-03-17T23:59:59Z");
      expect(events).toHaveLength(1);
      expect(events[0].summary).toBe("Test Meeting");
      expect(events[0].id).toBe("evt1");
    });
  });

  describe("getEvent", () => {
    it("returns a single event by ID", async () => {
      const event = await getEvent(token, "evt1");
      expect(event.id).toBe("evt1");
      expect(event.summary).toBe("Test Meeting");
      expect(event.attendees).toHaveLength(1);
    });
  });

  describe("createEvent", () => {
    it("creates a new event and returns it", async () => {
      const event = await createEvent(token, {
        summary: "New Meeting",
        start: { dateTime: "2025-03-18T14:00:00Z" },
        end: { dateTime: "2025-03-18T15:00:00Z" },
      });
      expect(event.id).toBe("new-evt");
      expect(event.summary).toBe("New Meeting");
    });
  });

  describe("getFreeBusy", () => {
    it("returns busy times for a calendar", async () => {
      const result = await getFreeBusy(token, "2025-03-17T00:00:00Z", "2025-03-17T23:59:59Z");
      expect(result.calendars.primary.busy).toHaveLength(1);
    });
  });
});
