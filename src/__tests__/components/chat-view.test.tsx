/**
 * Render tests for ChatView.
 */

jest.mock("@/hooks/use-chat", () => ({
  useChat: jest.fn(() => ({
    messages: [],
    sendMessage: jest.fn(),
    isLoading: false,
    clearMessages: jest.fn(),
  })),
}));

jest.mock("@/context/preferences-context", () => ({
  usePreferences: jest.fn(() => ({
    preferences: {
      workHoursStart: "09:00",
      workHoursEnd: "17:00",
      morningProtection: "10:00",
      bufferMinutes: 10,
      maxMeetingHoursPerDay: 6,
      defaultMeetingDuration: 30,
      focusBlockDuration: 120,
      timezone: "America/New_York",
    },
    updatePreferences: jest.fn(),
  })),
}));

jest.mock("@/context/panel-context", () => ({
  usePanel: jest.fn(() => ({
    centerView: "calendar",
    setCenterView: jest.fn(),
    panelState: { mode: "empty" },
    setPanelState: jest.fn(),
    activeConversationId: null,
    setActiveConversationId: jest.fn(),
    conversations: [],
    setConversations: jest.fn(),
    refreshConversations: jest.fn(),
    setRefreshConversations: jest.fn(),
    chatOpen: true,
    setChatOpen: jest.fn(),
    toggleChat: jest.fn(),
    attachedEvents: [],
    attachEvent: jest.fn(),
    removeAttachedEvent: jest.fn(),
    clearAttachedEvents: jest.fn(),
    calendarRefreshKey: 0,
    triggerCalendarRefresh: jest.fn(),
  })),
}));

import React from "react";
import { render, screen } from "@testing-library/react";
import { ChatView } from "@/components/chat/chat-view";

describe("ChatView", () => {
  it("renders empty state when no messages", () => {
    render(<ChatView />);
    expect(screen.getByText("How can I help you today?")).toBeInTheDocument();
  });

  it("renders action chips", () => {
    render(<ChatView />);
    expect(screen.getByText("Find free time")).toBeInTheDocument();
    expect(screen.getByText("Prep for next meeting")).toBeInTheDocument();
    expect(screen.getByText("How's my week?")).toBeInTheDocument();
  });

  it("renders input placeholder", () => {
    render(<ChatView />);
    expect(screen.getByPlaceholderText("Ask me anything about your calendar...")).toBeInTheDocument();
  });

  it("renders messages when present", () => {
    const { useChat } = require("@/hooks/use-chat");
    useChat.mockReturnValueOnce({
      messages: [
        { id: "1", role: "user", content: "Hello", timestamp: new Date() },
        { id: "2", role: "assistant", content: "Hi there!", timestamp: new Date() },
      ],
      sendMessage: jest.fn(),
      isLoading: false,
      clearMessages: jest.fn(),
    });

    render(<ChatView />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });
});
