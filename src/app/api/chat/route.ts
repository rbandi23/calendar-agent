import { NextRequest } from "next/server";
import { getAccessToken, auth, AuthTokenExpiredError } from "@/lib/auth";
import { getOpenAIClient } from "@/lib/claude";
import { chatTools, executeTool } from "@/lib/chat-tools";
import type { UserPreferences } from "@/types";
import { DEFAULT_PREFERENCES } from "@/types";
import type OpenAI from "openai";

const MODEL = "gpt-5-mini";
const MAX_TOOL_ROUNDS = 10;

function summarizeToolResult(toolName: string, result: unknown): string {
  try {
    if (Array.isArray(result)) {
      const count = result.length;
      switch (toolName) {
        case "list_calendar_events":
          return count === 0 ? "No events found" : `Found ${count} event${count === 1 ? "" : "s"}`;
        case "search_emails":
          return count === 0 ? "No emails found" : `Found ${count} email${count === 1 ? "" : "s"}`;
        case "search_contacts":
          return count === 0 ? "No contacts found" : `Found ${count} contact${count === 1 ? "" : "s"}`;
        default:
          return `${count} result${count === 1 ? "" : "s"}`;
      }
    }

    const obj = result as Record<string, unknown>;

    switch (toolName) {
      case "get_event_details":
        return obj.summary ? `"${obj.summary}"` : "Got details";
      case "create_calendar_event":
        if (obj.warning === "CONFLICT_DETECTED") return "Conflict detected — needs confirmation";
        return obj.summary ? `Created "${obj.summary}"` : "Event created";
      case "get_free_busy": {
        const calendars = obj.calendars as Record<string, { busy: unknown[] }> | undefined;
        if (calendars) {
          const totalBusy = Object.values(calendars).reduce(
            (sum, cal) => sum + (cal.busy?.length ?? 0), 0
          );
          return totalBusy === 0 ? "All clear" : `${totalBusy} busy block${totalBusy === 1 ? "" : "s"}`;
        }
        return "Checked availability";
      }
      case "propose_email":
        return obj.subject ? `Draft: "${obj.subject}"` : "Draft ready";
      case "analyze_meeting_time": {
        const hours = obj.totalHours as number | undefined;
        const count = obj.meetingCount as number | undefined;
        if (hours !== undefined && count !== undefined) {
          return `${count} meetings, ${hours.toFixed(1)}h total`;
        }
        return "Analysis complete";
      }
      case "prep_for_meeting":
        return obj.summary ? "Brief ready" : "Prepared";
      case "reschedule_event":
        return obj.summary ? `Rescheduled "${obj.summary}"` : "Event rescheduled";
      case "cancel_event":
        return "Event cancelled";
      case "get_user_preferences":
        return "Loaded";
      default:
        return "Done";
    }
  } catch {
    return "Done";
  }
}

function buildSystemPrompt(
  preferences: UserPreferences,
  user: { name?: string | null; email?: string | null }
): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a friendly, concise calendar assistant for ${user.name || "the user"} (${user.email || "unknown email"}).

Current date: ${today}
User timezone: ${preferences.timezone}
User name: ${user.name || "Unknown"}
User email: ${user.email || "Unknown"}

Preferences: work ${preferences.workHoursStart}–${preferences.workHoursEnd}, ${preferences.bufferMinutes}min buffer, max ${preferences.maxMeetingHoursPerDay}h meetings/day, morning protection until ${preferences.morningProtection}.

Response style:
- Talk like a helpful human assistant, not a robot dumping data.
- Be brief — 2-4 sentences max for simple answers.
- When prepping for meetings: give a quick natural summary of what you found. Mention key topics from emails conversationally ("Looks like you and Naman last discussed X..."). Don't list raw email subjects or metadata.
- For scheduling: suggest 2-3 specific times.
- For email drafts: ALWAYS use the propose_email tool. NEVER write email content as plain text in the chat. The tool renders an interactive card the user can edit and send. Sign off as "${user.name || ""}".
- Never dump raw JSON, IDs, or technical metadata to the user.

Rules:
- NEVER write email drafts as plain text. ALWAYS call propose_email — this is a hard requirement, not a suggestion. The user needs the interactive send/edit card.
- NEVER send emails or create Gmail drafts autonomously. Always use propose_email for user approval.
- Confirm before creating or rescheduling calendar events.
- Use ISO 8601 for API calls. Check free/busy before suggesting times.

Meeting prep workflow:
When the user asks to "prep for my next meeting" or "prep for [meeting name]":
1. If the message contains a [Referencing event: "..."] tag, extract the event title and use list_calendar_events to find it by name, then call prep_for_meeting with its ID.
2. If no reference, call list_calendar_events to get upcoming events (today and tomorrow). Skip all-day events. Pick the next one by start time.
3. If no upcoming meetings, say "You have no upcoming meetings today or tomorrow."
4. After calling prep_for_meeting, give a conversational brief — do NOT repeat the raw summary. Instead, highlight key points: who's attending, what you discussed recently over email, and any agenda notes.

Rescheduling workflow:
When the user asks to "move", "reschedule", or "change the time of" a meeting:
1. Use list_calendar_events or get_event_details to find the event
2. Confirm with the user: "I'll move [Event] from [old time] to [new time]. This will notify all [N] attendees. Proceed?"
3. Only after confirmation, use reschedule_event. The original duration is preserved automatically.
4. If the new time has conflicts, warn the user and suggest alternatives using get_free_busy.
- For recurring events, note that only the single instance is moved.
- Never reschedule past events.

Cancellation workflow:
When the user asks to "cancel" or "delete" a meeting:
1. Get the event details first
2. Confirm: "Cancel [Event] on [date]? All attendees will be notified."
3. Only after confirmation, use cancel_event.

Email-to-Meeting workflow:
When the user asks to "schedule a meeting about an email/thread" or "set up a call about this email":
1. Use search_emails to find the relevant thread based on the user's description (sender, subject keywords, etc.)
2. Extract participant email addresses from the From/To fields of the results
3. Use get_free_busy to check availability for all participants (note: external participants' availability may not be visible)
4. Suggest 2-3 time slots with a proposed meeting title derived from the email subject
5. If the user confirms, use create_calendar_event with the extracted attendees and a description referencing the email thread
Always explain your reasoning: "I found the thread with Sarah about Q3 planning. Let me check everyone's availability..."

Multi-person scheduling (IMPORTANT):
When proposing meeting times to MULTIPLE people separately (separate emails), you MUST suggest DIFFERENT time slots to each person. Never propose the same time to two different people — if both accept, the user gets double-booked.
- Example: Suggest 10am, 11am, 2pm to Person A and 10:30am, 1pm, 3pm to Person B.
- If there are limited free slots, explicitly tell the user: "I only found 2 open slots — I'll suggest the same options to both, but you can only book one."
- When the user asks to "schedule with Andrew AND Michael", prefer a single group meeting (one event with both as attendees). Only send separate emails when the user explicitly wants separate 1:1 meetings.

Email drafting rules:
- When the user asks to email multiple people, determine intent:
  - "Email them" / "send an email to X, Y, and Z" with ONE topic → single propose_email with all recipients comma-separated in "to". This sends ONE email to everyone.
  - "Send separate emails" / "email each of them individually" / "send them each a message" → call propose_email MULTIPLE TIMES, once per recipient. Each call creates a separate draft card the user can edit individually.
- When in doubt, default to a single group email — it's the common case.
- You can call propose_email multiple times in one response to create multiple draft cards.`;
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    const body = await request.json();

    const {
      messages,
      preferences: userPreferences,
    }: {
      messages: { role: "user" | "assistant"; content: string }[];
      preferences?: UserPreferences;
      conversationId?: string;
    } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const preferences = userPreferences ?? DEFAULT_PREFERENCES;
    const session = await auth();
    const user = session?.user ?? {};
    const userEmail = user.email ?? undefined;
    const systemPrompt = buildSystemPrompt(preferences, user);
    const openai = getOpenAIClient();

    const recentMessages = messages.slice(-10);

    let openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...recentMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    console.log("[chat] Starting agentic loop with", openaiMessages.length, "messages");

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const sendSSE = async (data: Record<string, unknown>) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };

    // Run the agentic loop in the background, streaming events as they happen
    (async () => {
      try {
        const structuredBlockEvents: Record<string, unknown>[] = [];
        let rounds = 0;

        while (rounds < MAX_TOOL_ROUNDS) {
          rounds++;
          console.log(`[chat] Round ${rounds} — calling ${MODEL}`);

          // Non-streaming call for tool rounds, streaming for final response
          const response = await openai.chat.completions.create({
            model: MODEL,
            tools: chatTools,
            messages: openaiMessages,
          });

          const choice = response.choices[0];
          if (!choice) throw new Error("No response from model");

          const message = choice.message;
          const toolCalls = message.tool_calls;

          console.log(`[chat] Round ${rounds} — finish_reason: ${choice.finish_reason}, tool_calls: ${toolCalls?.length ?? 0}`);

          // No tool calls → final response. Re-call with streaming enabled.
          if (!toolCalls || toolCalls.length === 0) {
            // Stream the final text token-by-token
            const stream = await openai.chat.completions.create({
              model: MODEL,
              messages: openaiMessages,
              stream: true,
            });

            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta?.content;
              if (delta) {
                await sendSSE({ type: "text", text: delta });
              }
            }

            // Emit structured blocks after text
            for (const block of structuredBlockEvents) {
              await sendSSE(block);
            }

            await sendSSE({ type: "done" });
            await writer.close();
            return;
          }

          // Execute tool calls — stream events in real-time
          const functionCalls = toolCalls.filter(
            (tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageToolCall & { type: "function" } =>
              tc.type === "function"
          );

          // Emit tool_call events immediately
          for (const tc of functionCalls) {
            console.log(`[chat] Tool call: ${tc.function.name}(${tc.function.arguments})`);
            let args = {};
            try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
            await sendSSE({
              type: "tool_call",
              id: tc.id,
              name: tc.function.name,
              args,
            });
          }

          // Execute tools in parallel
          const toolResults: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] =
            await Promise.all(
              functionCalls.map(async (toolCall) => {
                try {
                  const args = JSON.parse(toolCall.function.arguments);
                  const result = await executeTool(
                    toolCall.function.name,
                    args,
                    accessToken,
                    preferences,
                    userEmail
                  );
                  const resultStr = JSON.stringify(result);
                  console.log(`[chat] Tool result for ${toolCall.function.name} (${resultStr.length} chars)`);

                  await sendSSE({
                    type: "tool_result",
                    id: toolCall.id,
                    name: toolCall.function.name,
                    summary: summarizeToolResult(toolCall.function.name, result),
                  });

                  // Draft card for propose_email
                  if (toolCall.function.name === "propose_email") {
                    structuredBlockEvents.push({
                      type: "structured_block",
                      blockType: "draft",
                      data: result,
                    });
                  }

                  return {
                    role: "tool" as const,
                    tool_call_id: toolCall.id,
                    content: resultStr,
                  };
                } catch (error) {
                  const isAuthError =
                    (error instanceof Error &&
                      (error.message.includes("401") ||
                        error.message.includes("Unauthorized") ||
                        error.message.includes("invalid_grant") ||
                        error.message.includes("Token expired")));

                  console.error(
                    `[chat] Tool error for ${toolCall.function.name}:`,
                    error instanceof Error ? error.message : "Unknown error"
                  );

                  await sendSSE({
                    type: "tool_result",
                    id: toolCall.id,
                    name: toolCall.function.name,
                    summary: isAuthError
                      ? "Authentication expired"
                      : `${toolCall.function.name} failed`,
                    error: true,
                  });

                  // Propagate auth errors so the loop can abort
                  if (isAuthError) {
                    throw new AuthTokenExpiredError();
                  }

                  return {
                    role: "tool" as const,
                    tool_call_id: toolCall.id,
                    content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                  };
                }
              })
            );

          openaiMessages = [
            ...openaiMessages,
            message,
            ...toolResults,
          ];
        }

        await sendSSE({ type: "text", text: "Too many steps — please try a simpler request." });
        await sendSSE({ type: "done" });
        await writer.close();
      } catch (error) {
        console.error("[chat] Stream error:", error instanceof Error ? error.message : "Unknown error");
        try {
          if (error instanceof AuthTokenExpiredError) {
            await sendSSE({
              type: "auth_error",
              message: "Your Google session has expired. Please sign in again to reconnect your calendar and email.",
            });
          } else {
            await sendSSE({ type: "text", text: "Sorry, something went wrong. Please try again." });
          }
          await sendSSE({ type: "done" });
          await writer.close();
        } catch { /* writer may be closed */ }
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof AuthTokenExpiredError) {
      return new Response(
        JSON.stringify({ error: "token_expired" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    if (error instanceof Error && error.message === "Not authenticated") {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    console.error("POST /api/chat error:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({ error: "Chat request failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
