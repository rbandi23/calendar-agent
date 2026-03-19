import { computeAnalytics } from "@/lib/analytics";
import type { CalendarEvent, UserPreferences } from "@/types";

const defaultPrefs: UserPreferences = {
  workHoursStart: "09:00",
  workHoursEnd: "17:00",
  morningProtection: "10:00",
  bufferMinutes: 10,
  maxMeetingHoursPerDay: 6,
  defaultMeetingDuration: 30,
  focusBlockDuration: 120,
  timezone: "America/New_York",
};

function makeEvent(
  id: string,
  summary: string,
  startHour: number,
  endHour: number,
  day = "2025-03-17",
  recurring = false
): CalendarEvent {
  return {
    id,
    summary,
    start: { dateTime: `${day}T${String(startHour).padStart(2, "0")}:00:00Z` },
    end: { dateTime: `${day}T${String(endHour).padStart(2, "0")}:00:00Z` },
    ...(recurring ? { recurringEventId: "recurring-1" } : {}),
  };
}

describe("computeAnalytics", () => {
  it("handles empty events array", () => {
    const result = computeAnalytics([], defaultPrefs);
    expect(result.totalHours).toBe(0);
    expect(result.meetingCount).toBe(0);
    expect(result.byDay).toHaveLength(0);
    expect(result.recurringHours).toBe(0);
    expect(result.oneOffHours).toBe(0);
  });

  it("calculates total hours and meeting count", () => {
    const events = [
      makeEvent("1", "Standup", 9, 10),
      makeEvent("2", "Planning", 10, 12),
      makeEvent("3", "1:1", 14, 15),
    ];
    const result = computeAnalytics(events, defaultPrefs);
    expect(result.totalHours).toBe(4);
    expect(result.meetingCount).toBe(3);
  });

  it("separates recurring and one-off hours", () => {
    const events = [
      makeEvent("1", "Daily Standup", 9, 10, "2025-03-17", true),
      makeEvent("2", "Ad-hoc meeting", 14, 15, "2025-03-17", false),
    ];
    const result = computeAnalytics(events, defaultPrefs);
    expect(result.recurringHours).toBe(1);
    expect(result.oneOffHours).toBe(1);
  });

  it("computes per-day breakdown", () => {
    const events = [
      makeEvent("1", "Mon meeting", 9, 11, "2025-03-17"),
      makeEvent("2", "Tue meeting", 9, 10, "2025-03-18"),
    ];
    const result = computeAnalytics(events, defaultPrefs);
    expect(result.byDay.length).toBeGreaterThanOrEqual(2);
    expect(result.byDay.some((d) => d.hours === 2)).toBe(true);
    expect(result.byDay.some((d) => d.hours === 1)).toBe(true);
  });

  it("skips all-day events without dateTime", () => {
    const events: CalendarEvent[] = [
      {
        id: "1",
        summary: "All Day Event",
        start: { date: "2025-03-17" },
        end: { date: "2025-03-18" },
      },
    ];
    const result = computeAnalytics(events, defaultPrefs);
    expect(result.meetingCount).toBe(0);
    expect(result.totalHours).toBe(0);
  });

  it("generates recommendations when overloaded", () => {
    const events = [
      makeEvent("1", "Meet 1", 9, 12),
      makeEvent("2", "Meet 2", 13, 16),
      makeEvent("3", "Meet 3", 16, 18),
    ];
    const result = computeAnalytics(events, defaultPrefs);
    expect(result.totalHours).toBeGreaterThanOrEqual(8);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("gives positive feedback when balanced", () => {
    const events = [makeEvent("1", "Quick sync", 10, 11)];
    const result = computeAnalytics(events, defaultPrefs);
    expect(result.recommendations[0]).toContain("well-balanced");
  });
});
