/**
 * Render tests for CalendarView.
 * We mock FullCalendar since it requires a DOM environment.
 */

jest.mock("@fullcalendar/react", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: React.forwardRef(function MockFullCalendar(
      props: { events: unknown[] },
      ref: unknown
    ) {
      return React.createElement("div", { "data-testid": "fullcalendar" }, `${(props.events || []).length} events`);
    }),
  };
});

jest.mock("@fullcalendar/daygrid", () => ({}));
jest.mock("@fullcalendar/timegrid", () => ({}));
jest.mock("@fullcalendar/interaction", () => ({}));

jest.mock("@/context/panel-context", () => ({
  usePanel: jest.fn(() => ({
    setPanelState: jest.fn(),
    panelState: { mode: "empty" },
    centerView: "calendar",
    setCenterView: jest.fn(),
    calendarRefreshKey: 0,
    triggerCalendarRefresh: jest.fn(),
  })),
}));

jest.mock("@/components/context/analytics-panel", () => ({
  AnalyticsPanel: () => {
    const React = require("react");
    return React.createElement("div", { "data-testid": "analytics-panel" }, "Analytics");
  },
}));

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { CalendarView } from "@/components/calendar/calendar-view";

// Mock fetch
beforeEach(() => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        events: [
          {
            id: "e1",
            summary: "Test Meeting",
            start: { dateTime: "2025-03-17T10:00:00Z" },
            end: { dateTime: "2025-03-17T11:00:00Z" },
          },
        ],
      }),
  });
});

describe("CalendarView", () => {
  it("renders toolbar with Week and Month tabs", async () => {
    render(<CalendarView />);
    expect(screen.getByText("Week")).toBeInTheDocument();
    expect(screen.getByText("Month")).toBeInTheDocument();
  });

  it("renders Today button", async () => {
    render(<CalendarView />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("renders FullCalendar after loading", async () => {
    render(<CalendarView />);
    await waitFor(() => {
      expect(screen.getByTestId("fullcalendar")).toBeInTheDocument();
    });
  });
});
