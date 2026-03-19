import { searchMessages } from "@/lib/gmail-service";

jest.mock("@/lib/google", () => ({
  getGmailClient: jest.fn(() => ({
    users: {
      messages: {
        list: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: "msg1" }, { id: "msg2" }],
          },
        }),
        get: jest.fn().mockImplementation(({ id }: { id: string }) => {
          return Promise.resolve({
            data: {
              id,
              threadId: `thread-${id}`,
              snippet: `Snippet for ${id}`,
              payload: {
                headers: [
                  { name: "Subject", value: `Subject ${id}` },
                  { name: "From", value: "sender@test.com" },
                  { name: "To", value: "me@test.com" },
                  { name: "Date", value: "Mon, 17 Mar 2025 10:00:00 +0000" },
                ],
              },
            },
          });
        }),
      },
      drafts: {
        create: jest.fn().mockResolvedValue({
          data: { id: "draft-1" },
        }),
      },
    },
  })),
}));

describe("gmail-service", () => {
  const token = "test-token";

  describe("searchMessages", () => {
    it("returns email threads matching a query", async () => {
      const results = await searchMessages(token, "from:sender@test.com", 10);
      expect(results).toHaveLength(2);
      expect(results[0].subject).toBe("Subject msg1");
      expect(results[0].from).toBe("sender@test.com");
      expect(results[1].id).toBe("msg2");
    });

    it("returns empty array when no messages found", async () => {
      const { getGmailClient } = require("@/lib/google");
      getGmailClient.mockReturnValueOnce({
        users: {
          messages: {
            list: jest.fn().mockResolvedValue({ data: { messages: null } }),
            get: jest.fn(),
          },
        },
      });

      const results = await searchMessages(token, "nonexistent", 5);
      expect(results).toHaveLength(0);
    });
  });
});
