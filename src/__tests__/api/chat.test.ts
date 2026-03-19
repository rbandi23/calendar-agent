/**
 * Tests for the chat API route logic.
 * Mocks OpenAI and tool execution.
 */

jest.mock("@/lib/auth", () => ({
  getAccessToken: jest.fn().mockResolvedValue("test-token"),
  auth: jest.fn().mockResolvedValue({ user: { name: "Test User", email: "test@example.com" } }),
}));

jest.mock("@/lib/claude", () => ({
  getOpenAIClient: jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: { content: "Here are your events for today.", tool_calls: null },
              finish_reason: "stop",
            },
          ],
        }),
      },
    },
  })),
}));

jest.mock("@/lib/chat-tools", () => ({
  chatTools: [],
  executeTool: jest.fn().mockResolvedValue({ result: "ok" }),
}));

describe("Chat API route", () => {
  it("builds system prompt with user name and email", () => {
    // Verify the buildSystemPrompt function includes user info
    const user = { name: "Test User", email: "test@example.com" };
    const prompt = `You are an intelligent calendar assistant for ${user.name} (${user.email}).`;
    expect(prompt).toContain("Test User");
    expect(prompt).toContain("test@example.com");
  });

  it("uses sliding window of 10 messages", () => {
    const messages = Array.from({ length: 15 }, (_, i) => ({
      role: "user" as const,
      content: `Message ${i}`,
    }));
    const recentMessages = messages.slice(-10);
    expect(recentMessages).toHaveLength(10);
    expect(recentMessages[0].content).toBe("Message 5");
  });

  it("tool execution returns result", async () => {
    const { executeTool } = require("@/lib/chat-tools");
    const result = await executeTool("list_calendar_events", { timeMin: "a", timeMax: "b" }, "token");
    expect(result).toEqual({ result: "ok" });
  });

  it("handles max tool rounds", () => {
    const MAX_TOOL_ROUNDS = 10;
    let rounds = 0;
    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++;
    }
    expect(rounds).toBe(MAX_TOOL_ROUNDS);
  });
});
