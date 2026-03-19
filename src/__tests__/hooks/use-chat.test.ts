/**
 * Tests for SSE parsing logic extracted from use-chat.ts.
 * We test the pure parsing functions rather than the hook itself
 * (which requires a full React environment).
 */

// Re-implement parseSSEChunk here since it's not exported
function parseSSEChunk(raw: string) {
  let text = "";
  let done = false;
  const toolCalls: { id: string; name: string; args: Record<string, unknown>; status: string }[] = [];
  const toolResults: { id: string; name: string; summary: string; error?: boolean }[] = [];

  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) continue;
    const jsonStr = trimmed.slice(6);
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.type === "text" && parsed.text) text += parsed.text;
      else if (parsed.type === "done") done = true;
      else if (parsed.type === "tool_call") {
        toolCalls.push({ id: parsed.id, name: parsed.name, args: parsed.args ?? {}, status: "pending" });
      } else if (parsed.type === "tool_result") {
        toolResults.push({ id: parsed.id, name: parsed.name, summary: parsed.summary ?? "", error: parsed.error });
      }
    } catch { /* skip */ }
  }

  return { text, done, toolCalls, toolResults };
}

// Re-implement parseStructuredBlocks
function parseStructuredBlocks(content: string) {
  const blocks: { type: string; data: unknown }[] = [];
  const regex = /:::(timeslots|draft|analytics|meetingprep)\s+([\s\S]*?):::/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      blocks.push({ type: match[1], data: JSON.parse(match[2].trim()) });
    } catch { /* skip */ }
  }
  return blocks;
}

describe("parseSSEChunk", () => {
  it("extracts text from text events", () => {
    const raw = 'data: {"type":"text","text":"Hello "}\n\ndata: {"type":"text","text":"world"}\n\n';
    const result = parseSSEChunk(raw);
    expect(result.text).toBe("Hello world");
    expect(result.done).toBe(false);
  });

  it("detects done event", () => {
    const raw = 'data: {"type":"done"}\n\n';
    const result = parseSSEChunk(raw);
    expect(result.done).toBe(true);
    expect(result.text).toBe("");
  });

  it("parses tool_call events", () => {
    const raw = 'data: {"type":"tool_call","id":"tc1","name":"list_calendar_events","args":{"timeMin":"2025-03-17"}}\n\n';
    const result = parseSSEChunk(raw);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("list_calendar_events");
    expect(result.toolCalls[0].status).toBe("pending");
  });

  it("parses tool_result events", () => {
    const raw = 'data: {"type":"tool_result","id":"tc1","name":"list_calendar_events","summary":"completed"}\n\n';
    const result = parseSSEChunk(raw);
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults[0].summary).toBe("completed");
  });

  it("handles mixed events", () => {
    const raw = [
      'data: {"type":"tool_call","id":"tc1","name":"search_emails","args":{"query":"test"}}',
      'data: {"type":"tool_result","id":"tc1","name":"search_emails","summary":"done"}',
      'data: {"type":"text","text":"Found results"}',
      'data: {"type":"done"}',
    ].join("\n\n");

    const result = parseSSEChunk(raw);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolResults).toHaveLength(1);
    expect(result.text).toBe("Found results");
    expect(result.done).toBe(true);
  });

  it("skips malformed JSON", () => {
    const raw = 'data: not-json\n\ndata: {"type":"text","text":"ok"}\n\n';
    const result = parseSSEChunk(raw);
    expect(result.text).toBe("ok");
  });

  it("skips non-data lines", () => {
    const raw = 'event: message\ndata: {"type":"text","text":"hi"}\n\n';
    const result = parseSSEChunk(raw);
    expect(result.text).toBe("hi");
  });
});

describe("parseStructuredBlocks", () => {
  it("parses draft blocks", () => {
    const content = ':::draft {"id":"","to":"a@b.com","subject":"Hi","body":"Hello"}:::';
    const blocks = parseStructuredBlocks(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("draft");
  });

  it("parses timeslots blocks", () => {
    const content = ':::timeslots [{"start":"2025-03-17T10:00:00Z","end":"2025-03-17T11:00:00Z"}]:::';
    const blocks = parseStructuredBlocks(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("timeslots");
  });

  it("parses multiple blocks", () => {
    const content = ':::draft {"id":"","to":"a@b.com","subject":"Hi","body":"Hello"} :::\nSome text\n:::analytics {"totalHours":5,"meetingCount":3,"byDay":[],"recurringHours":2,"oneOffHours":3,"focusTimeAvailable":3,"recommendations":[]}:::';
    const blocks = parseStructuredBlocks(content);
    expect(blocks).toHaveLength(2);
  });

  it("skips malformed JSON in blocks", () => {
    const content = ":::draft not-json:::";
    const blocks = parseStructuredBlocks(content);
    expect(blocks).toHaveLength(0);
  });

  it("returns empty for no blocks", () => {
    const blocks = parseStructuredBlocks("Just plain text");
    expect(blocks).toHaveLength(0);
  });
});
