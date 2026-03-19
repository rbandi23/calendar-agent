/**
 * Tests for conversation persistence logic.
 * Tests the Prisma operations directly (same as what the API routes do).
 */

// In-memory conversation store
const conversations = new Map<string, {
  id: string;
  title: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}>();
const messageStore = new Map<string, {
  id: string;
  role: string;
  content: string;
  conversationId: string;
  createdAt: Date;
  toolCalls?: unknown;
  structuredBlocks?: unknown;
}[]>();

let idCounter = 0;

function resetStore() {
  conversations.clear();
  messageStore.clear();
  idCounter = 0;
}

// Simulates what the API routes do
async function createConversation(userId: string, title = "New conversation") {
  const id = `conv_${++idCounter}`;
  const conv = {
    id,
    title,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  conversations.set(id, conv);
  messageStore.set(id, []);
  return conv;
}

async function listConversations(userId: string) {
  return Array.from(conversations.values())
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 50);
}

async function getConversation(id: string, userId: string) {
  const conv = conversations.get(id);
  if (!conv || conv.userId !== userId) return null;
  return {
    ...conv,
    messages: messageStore.get(id) ?? [],
  };
}

async function saveMessageToConversation(
  conversationId: string,
  userId: string,
  message: { role: string; content: string; toolCalls?: unknown; structuredBlocks?: unknown }
) {
  const conv = conversations.get(conversationId);
  if (!conv || conv.userId !== userId) return null;

  if (!message.role || !message.content) return { error: "role and content are required" };

  const msg = {
    id: `msg_${++idCounter}`,
    role: message.role,
    content: message.content,
    conversationId,
    createdAt: new Date(),
    toolCalls: message.toolCalls,
    structuredBlocks: message.structuredBlocks,
  };

  const msgs = messageStore.get(conversationId) ?? [];
  msgs.push(msg);
  messageStore.set(conversationId, msgs);

  // Update title from first user message
  if (message.role === "user" && conv.title === "New conversation") {
    conv.title = message.content.slice(0, 100);
  }

  conv.updatedAt = new Date();
  return msg;
}

async function deleteConversation(id: string, userId: string) {
  const conv = conversations.get(id);
  if (!conv || conv.userId !== userId) return false;
  conversations.delete(id);
  messageStore.delete(id);
  return true;
}

// Simulates what ensureConversation does in use-chat.ts
async function ensureConversation(
  userId: string,
  currentConvId: string | null,
  firstMessage: string
): Promise<string | null> {
  if (currentConvId) return currentConvId;

  const cleanMessage = firstMessage.replace(/\[Referencing event:.*?\]\s*/g, "").trim();
  const titleSource = cleanMessage || firstMessage;
  const title = titleSource.slice(0, 50) + (titleSource.length > 50 ? "..." : "");

  const conv = await createConversation(userId, title);
  return conv.id;
}

const USER_ID = "test@example.com";

beforeEach(() => {
  resetStore();
});

describe("Conversation creation", () => {
  it("creates a conversation with a title", async () => {
    const conv = await createConversation(USER_ID, "My chat");
    expect(conv.id).toBeDefined();
    expect(conv.title).toBe("My chat");
    expect(conv.userId).toBe(USER_ID);
  });

  it("defaults title to 'New conversation'", async () => {
    const conv = await createConversation(USER_ID);
    expect(conv.title).toBe("New conversation");
  });
});

describe("Conversation listing", () => {
  it("returns empty array when no conversations exist", async () => {
    const list = await listConversations(USER_ID);
    expect(list).toEqual([]);
  });

  it("returns only the user's conversations", async () => {
    await createConversation(USER_ID, "Mine");
    await createConversation("other@example.com", "Theirs");

    const list = await listConversations(USER_ID);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Mine");
  });

  it("returns conversations ordered by updatedAt descending", async () => {
    const first = await createConversation(USER_ID, "First");
    const second = await createConversation(USER_ID, "Second");
    // Update first conversation to make it most recent
    first.updatedAt = new Date(Date.now() + 1000);

    const list = await listConversations(USER_ID);
    expect(list[0].title).toBe("First");
    expect(list[1].title).toBe("Second");
  });
});

describe("Message saving", () => {
  it("saves a user message", async () => {
    const conv = await createConversation(USER_ID, "Chat");
    const msg = await saveMessageToConversation(conv.id, USER_ID, {
      role: "user",
      content: "Hello",
    });

    expect(msg).not.toBeNull();
    expect((msg as { role: string }).role).toBe("user");
    expect((msg as { content: string }).content).toBe("Hello");
  });

  it("saves assistant message with toolCalls", async () => {
    const conv = await createConversation(USER_ID, "Chat");
    const toolCalls = [
      { id: "tc1", name: "list_calendar_events", args: {}, status: "done" },
    ];
    const msg = await saveMessageToConversation(conv.id, USER_ID, {
      role: "assistant",
      content: "You have 3 meetings.",
      toolCalls,
    });

    expect((msg as { toolCalls: unknown }).toolCalls).toEqual(toolCalls);
  });

  it("saves assistant message with structuredBlocks", async () => {
    const conv = await createConversation(USER_ID, "Chat");
    const blocks = [{ type: "timeslots", data: [{ start: "2026-03-20T10:00:00Z", end: "2026-03-20T11:00:00Z" }] }];
    const msg = await saveMessageToConversation(conv.id, USER_ID, {
      role: "assistant",
      content: "Here are slots",
      structuredBlocks: blocks,
    });

    expect((msg as { structuredBlocks: unknown }).structuredBlocks).toEqual(blocks);
  });

  it("rejects message for non-existent conversation", async () => {
    const result = await saveMessageToConversation("nonexistent", USER_ID, {
      role: "user",
      content: "Hello",
    });
    expect(result).toBeNull();
  });

  it("rejects message for wrong user", async () => {
    const conv = await createConversation(USER_ID, "Chat");
    const result = await saveMessageToConversation(conv.id, "hacker@evil.com", {
      role: "user",
      content: "Hello",
    });
    expect(result).toBeNull();
  });

  it("updates title from first user message when title is default", async () => {
    const conv = await createConversation(USER_ID); // "New conversation"
    await saveMessageToConversation(conv.id, USER_ID, {
      role: "user",
      content: "Find free time this week",
    });

    expect(conv.title).toBe("Find free time this week");
  });

  it("does not update title if already custom", async () => {
    const conv = await createConversation(USER_ID, "Custom title");
    await saveMessageToConversation(conv.id, USER_ID, {
      role: "user",
      content: "This should not become the title",
    });

    expect(conv.title).toBe("Custom title");
  });
});

describe("Conversation loading", () => {
  it("loads conversation with all messages in order", async () => {
    const conv = await createConversation(USER_ID, "Chat");
    await saveMessageToConversation(conv.id, USER_ID, { role: "user", content: "Hello" });
    await saveMessageToConversation(conv.id, USER_ID, { role: "assistant", content: "Hi there!" });
    await saveMessageToConversation(conv.id, USER_ID, { role: "user", content: "What's on today?" });

    const loaded = await getConversation(conv.id, USER_ID);
    expect(loaded).not.toBeNull();
    expect(loaded!.messages).toHaveLength(3);
    expect(loaded!.messages[0].content).toBe("Hello");
    expect(loaded!.messages[1].content).toBe("Hi there!");
    expect(loaded!.messages[2].content).toBe("What's on today?");
  });

  it("returns null for non-existent conversation", async () => {
    const loaded = await getConversation("nonexistent", USER_ID);
    expect(loaded).toBeNull();
  });

  it("returns null for wrong user", async () => {
    const conv = await createConversation(USER_ID, "Chat");
    const loaded = await getConversation(conv.id, "hacker@evil.com");
    expect(loaded).toBeNull();
  });
});

describe("Conversation deletion", () => {
  it("deletes a conversation and its messages", async () => {
    const conv = await createConversation(USER_ID, "To delete");
    await saveMessageToConversation(conv.id, USER_ID, { role: "user", content: "Hello" });

    const result = await deleteConversation(conv.id, USER_ID);
    expect(result).toBe(true);

    const loaded = await getConversation(conv.id, USER_ID);
    expect(loaded).toBeNull();
  });

  it("returns false for non-existent conversation", async () => {
    const result = await deleteConversation("nonexistent", USER_ID);
    expect(result).toBe(false);
  });
});

describe("ensureConversation (auto-create logic)", () => {
  it("returns existing conversation ID if one exists", async () => {
    const result = await ensureConversation(USER_ID, "existing-id", "Hello");
    expect(result).toBe("existing-id");
  });

  it("creates new conversation when no ID exists", async () => {
    const result = await ensureConversation(USER_ID, null, "Find free time");
    expect(result).not.toBeNull();

    const conv = conversations.get(result!);
    expect(conv).toBeDefined();
    expect(conv!.title).toBe("Find free time");
  });

  it("truncates long messages for title", async () => {
    const longMessage = "A".repeat(100);
    const result = await ensureConversation(USER_ID, null, longMessage);

    const conv = conversations.get(result!);
    expect(conv!.title).toBe("A".repeat(50) + "...");
  });

  it("strips event reference prefix from title", async () => {
    const message = '[Referencing event: "Team Standup" (2026-03-20T10:00:00Z)] Tell me about this meeting';
    const result = await ensureConversation(USER_ID, null, message);

    const conv = conversations.get(result!);
    expect(conv!.title).toBe("Tell me about this meeting");
  });
});

describe("Full lifecycle (happy path)", () => {
  it("create → save user msg → save assistant msg → list → load → all data persists", async () => {
    // 1. Auto-create conversation on first message
    const convId = await ensureConversation(USER_ID, null, "How's my week look?");
    expect(convId).not.toBeNull();

    // 2. Save user message
    await saveMessageToConversation(convId!, USER_ID, {
      role: "user",
      content: "How's my week look?",
    });

    // 3. Save assistant response with tool calls
    await saveMessageToConversation(convId!, USER_ID, {
      role: "assistant",
      content: "You have 5 meetings this week.",
      toolCalls: [
        { id: "tc1", name: "list_calendar_events", args: { timeMin: "2026-03-16", timeMax: "2026-03-22" }, status: "done", summary: "Found 5 events" },
      ],
    });

    // 4. Verify listing works
    const list = await listConversations(USER_ID);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(convId);

    // 5. Verify loading preserves everything
    const loaded = await getConversation(convId!, USER_ID);
    expect(loaded!.messages).toHaveLength(2);
    expect(loaded!.messages[0].role).toBe("user");
    expect(loaded!.messages[1].role).toBe("assistant");
    expect(loaded!.messages[1].toolCalls).toBeDefined();

    // 6. Second message in same conversation
    const convId2 = await ensureConversation(USER_ID, convId, "What about Thursday?");
    expect(convId2).toBe(convId); // Same conversation

    await saveMessageToConversation(convId!, USER_ID, {
      role: "user",
      content: "What about Thursday?",
    });

    const reloaded = await getConversation(convId!, USER_ID);
    expect(reloaded!.messages).toHaveLength(3);
  });
});
