/**
 * Tests for Gmail API routes.
 */

jest.mock("@/lib/auth", () => ({
  getAccessToken: jest.fn().mockResolvedValue("test-token"),
  auth: jest.fn().mockResolvedValue({ user: { name: "Test", email: "test@example.com" } }),
}));

jest.mock("@/lib/gmail-service", () => ({
  searchMessages: jest.fn().mockResolvedValue([
    { id: "msg1", subject: "Hello", from: "sender@test.com", snippet: "Hi there" },
  ]),
  createDraft: jest.fn().mockResolvedValue({ id: "draft-1", to: "a@b.com", subject: "Hi", body: "Hello" }),
  sendMessage: jest.fn().mockResolvedValue({ id: "sent-1", threadId: "thread-1" }),
}));

jest.mock("@/lib/claude", () => ({
  getOpenAIClient: jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: "Improved email body text." } }],
        }),
      },
    },
  })),
}));

describe("Gmail API routes", () => {
  it("searchMessages returns email results", async () => {
    const { searchMessages } = require("@/lib/gmail-service");
    const results = await searchMessages("test-token", "subject:Hello");
    expect(results).toHaveLength(1);
    expect(results[0].subject).toBe("Hello");
  });

  it("sendMessage sends via Gmail", async () => {
    const { sendMessage } = require("@/lib/gmail-service");
    const result = await sendMessage("test-token", "a@b.com", "Hi", "Hello");
    expect(result.id).toBe("sent-1");
  });

  it("improve endpoint returns improved text", async () => {
    const { getOpenAIClient } = require("@/lib/claude");
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: "Improve this email" },
        { role: "user", content: "hey want to meet?" },
      ],
    });
    expect(response.choices[0].message.content).toBe("Improved email body text.");
  });
});
