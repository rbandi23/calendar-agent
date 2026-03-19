import type { CalendarEvent, AnalyticsData, UserPreferences } from "@/types";

/**
 * Compute analytics from a list of calendar events and user preferences.
 */
export function computeAnalytics(
  events: CalendarEvent[],
  preferences: UserPreferences
): AnalyticsData {
  const byDayMap: Record<string, number> = {};
  let totalMinutes = 0;
  let recurringMinutes = 0;
  let oneOffMinutes = 0;
  let meetingCount = 0;

  for (const event of events) {
    if (!event.start?.dateTime || !event.end?.dateTime) continue;

    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

    if (durationMinutes <= 0) continue;

    meetingCount++;
    totalMinutes += durationMinutes;

    // Recurring vs one-off
    if (event.recurringEventId) {
      recurringMinutes += durationMinutes;
    } else {
      oneOffMinutes += durationMinutes;
    }

    // Per-day breakdown
    const dayKey = start.toLocaleDateString("en-US", { weekday: "long" });
    byDayMap[dayKey] = (byDayMap[dayKey] ?? 0) + durationMinutes;
  }

  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
  const recurringHours = Math.round((recurringMinutes / 60) * 100) / 100;
  const oneOffHours = Math.round((oneOffMinutes / 60) * 100) / 100;

  // Per-day hours
  const byDay = Object.entries(byDayMap).map(([day, mins]) => ({
    day,
    hours: Math.round((mins / 60) * 100) / 100,
  }));

  // Calculate focus time: total work hours minus meeting hours
  const workStart = parseTimeToMinutes(preferences.workHoursStart);
  const workEnd = parseTimeToMinutes(preferences.workHoursEnd);
  const workMinutesPerDay = workEnd - workStart;

  // Count unique work days in the events
  const uniqueDays = new Set<string>();
  for (const event of events) {
    if (event.start?.dateTime) {
      uniqueDays.add(new Date(event.start.dateTime).toISOString().slice(0, 10));
    }
  }
  const workDays = Math.max(uniqueDays.size, 1);
  const totalWorkMinutes = workDays * workMinutesPerDay;
  const focusTimeAvailable = Math.round(
    Math.max(0, (totalWorkMinutes - totalMinutes) / 60 * 100) / 100
  );

  // Generate recommendations
  const recommendations = generateRecommendations(
    totalHours,
    meetingCount,
    recurringHours,
    oneOffHours,
    focusTimeAvailable,
    byDay,
    workDays,
    preferences
  );

  return {
    totalHours,
    meetingCount,
    byDay,
    recurringHours,
    oneOffHours,
    focusTimeAvailable,
    recommendations,
  };
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

function generateRecommendations(
  totalHours: number,
  meetingCount: number,
  recurringHours: number,
  oneOffHours: number,
  focusTimeAvailable: number,
  byDay: { day: string; hours: number }[],
  workDays: number,
  preferences: UserPreferences
): string[] {
  const recommendations: string[] = [];
  const avgHoursPerDay = workDays > 0 ? totalHours / workDays : 0;

  if (avgHoursPerDay > preferences.maxMeetingHoursPerDay) {
    recommendations.push(
      `You're averaging ${avgHoursPerDay.toFixed(1)} meeting hours/day, exceeding your ${preferences.maxMeetingHoursPerDay}h limit. Consider declining optional meetings.`
    );
  }

  if (recurringHours > totalHours * 0.6) {
    recommendations.push(
      `Recurring meetings make up ${Math.round((recurringHours / totalHours) * 100)}% of your meeting time. Audit recurring meetings for ones that could be async.`
    );
  }

  if (focusTimeAvailable < workDays * 2) {
    recommendations.push(
      "You have limited focus time. Consider blocking dedicated focus time on your calendar."
    );
  }

  // Find the heaviest day
  const heaviest = byDay.reduce(
    (max, d) => (d.hours > max.hours ? d : max),
    { day: "", hours: 0 }
  );
  if (heaviest.hours > preferences.maxMeetingHoursPerDay) {
    recommendations.push(
      `${heaviest.day} is your busiest day with ${heaviest.hours.toFixed(1)}h of meetings. Try redistributing some meetings to lighter days.`
    );
  }

  if (meetingCount > 0 && totalHours / meetingCount < 0.5) {
    recommendations.push(
      "Many of your meetings are under 30 minutes. Consider batching short syncs into a single slot."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Your calendar looks well-balanced. Keep up the good time management!"
    );
  }

  return recommendations;
}
