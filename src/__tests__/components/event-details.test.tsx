/**
 * Render tests for EventDetails.
 * Verifies: no delete button, email attendees button, prep button.
 */

jest.mock("@/context/panel-context", () => ({
  usePanel: jest.fn(() => ({
    setPanelState: jest.fn(),
    setCenterView: jest.fn(),
    panelState: { mode: "event", eventId: "e1" },
    centerView: "calendar",
  })),
}));

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { EventDetails } from "@/components/context/event-details";

beforeEach(() => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        event: {
          id: "e1",
          summary: "Team Standup",
          start: { dateTime: "2025-03-17T10:00:00Z" },
          end: { dateTime: "2025-03-17T10:30:00Z" },
          attendees: [
            { email: "alice@test.com", displayName: "Alice", responseStatus: "accepted" },
            { email: "bob@test.com", displayName: "Bob", responseStatus: "tentative" },
          ],
          location: "Conference Room A",
          description: "Daily standup sync",
        },
      }),
  });
});

describe("EventDetails", () => {
  it("renders event title", async () => {
    render(<EventDetails eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText("Team Standup")).toBeInTheDocument();
    });
  });

  it("renders location", async () => {
    render(<EventDetails eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText("Conference Room A")).toBeInTheDocument();
    });
  });

  it("renders attendees", async () => {
    render(<EventDetails eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("renders Email attendees button", async () => {
    render(<EventDetails eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText("Email attendees")).toBeInTheDocument();
    });
  });

  it("renders Prep for meeting button", async () => {
    render(<EventDetails eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText("Prep for meeting")).toBeInTheDocument();
    });
  });

  it("does NOT render delete button", async () => {
    render(<EventDetails eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText("Team Standup")).toBeInTheDocument();
    });
    expect(screen.queryByText("Delete event")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });
});
