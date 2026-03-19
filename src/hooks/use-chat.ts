"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  ChatMessage,
  StructuredBlock,
  TimeSlot,
  EmailDraft,
  AnalyticsData,
  MeetingPrepData,
  ToolCallStatus,
  UserPreferences,
} from "@/types";

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseStructuredBlocks(content: string): StructuredBlock[] {
  const blocks: StructuredBlock[] = [];
  const regex = /:::(timeslots|draft|analytics|meetingprep)\s+([\s\S]*?):::/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const blockType = match[1] as StructuredBlock["type"];
    const rawData = match[2].trim();

    try {
      const parsed = JSON.parse(rawData);

      if (blockType === "timeslots") {
        blocks.push({ type: "timeslots", data: parsed as TimeSlot[] });
      } else if (blockType === "draft") {
        blocks.push({ type: "draft", data: parsed as EmailDraft });
      } else if (blockType === "analytics") {
        blocks.push({ type: "analytics", data: parsed as AnalyticsData });
      } else if (blockType === "meetingprep") {
        blocks.push({ type: "meetingprep", data: parsed as MeetingPrepData });
      }
    } catch {
      // Skip malformed blocks
    }
  }

  return blocks;
}

function parseStructuredBlockEvent(blockType: string, data: unknown): StructuredBlock | null {
  if (blockType === "draft" && data) {
    return { type: "draft", data: data as EmailDraft };
  }
  if (blockType === "meetingprep" && data) {
    return { type: "meetingprep", data: data as MeetingPrepData };
  }
  if (blockType === "analytics" && data) {
    return { type: "analytics", data: data as AnalyticsData };
  }
  if (blockType === "timeslots" && data) {
    return { type: "timeslots", data: data as TimeSlot[] };
  }
  return null;
}

function parseSSEChunk(raw: string): {
  text: string;
  done: boolean;
  authError: string | null;
  toolCalls: ToolCallStatus[];
  toolResults: { id: string; name: string; summary: string; error?: boolean }[];
  structuredBlocks: StructuredBlock[];
} {
  let text = "";
  let done = false;
  let authError: string | null = null;
  const toolCalls: ToolCallStatus[] = [];
  const toolResults: { id: string; name: string; summary: string; error?: boolean }[] = [];
  const structuredBlocks: StructuredBlock[] = [];

  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) continue;

    const jsonStr = trimmed.slice(6);
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.type === "text" && parsed.text) {
        text += parsed.text;
      } else if (parsed.type === "done") {
        done = true;
      } else if (parsed.type === "auth_error") {
        authError = parsed.message ?? "Your session has expired. Please sign in again.";
      } else if (parsed.type === "tool_call") {
        toolCalls.push({
          id: parsed.id,
          name: parsed.name,
          args: parsed.args ?? {},
          status: "pending",
          startedAt: Date.now(),
        });
      } else if (parsed.type === "tool_result") {
        toolResults.push({
          id: parsed.id,
          name: parsed.name,
          summary: parsed.summary ?? "",
          error: parsed.error,
        });
      } else if (parsed.type === "structured_block") {
        const block = parseStructuredBlockEvent(parsed.blockType, parsed.data);
        if (block) structuredBlocks.push(block);
      }
    } catch {
      // Skip unparseable lines
    }
  }

  return { text, done, authError, toolCalls, toolResults, structuredBlocks };
}

// Mutating tool names that should trigger a calendar refresh
const CALENDAR_MUTATING_TOOLS = new Set([
  "create_calendar_event",
  "reschedule_event",
  "cancel_event",
]);

interface UseChatOptions {
  conversationId?: string | null;
  onConversationCreated?: (id: string) => void;
  onCalendarMutation?: () => void;
}

export function useChat(preferences: UserPreferences, options?: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(options?.conversationId ?? null);
  const creatingConversationRef = useRef(false);
  const justCreatedRef = useRef(false);

  // Stable ref for options callbacks so they don't cause re-renders
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Load messages from DB when conversationId changes
  useEffect(() => {
    const newId = options?.conversationId ?? null;
    conversationIdRef.current = newId;

    // If we just created this conversation ourselves, don't reload (messages are already in state)
    if (justCreatedRef.current) {
      justCreatedRef.current = false;
      return;
    }

    if (newId) {
      loadConversation(newId);
    } else {
      setMessages([]);
    }
  }, [options?.conversationId]);

  const loadConversation = async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages) {
          setMessages(
            data.messages.map((m: { id: string; role: string; content: string; toolCalls?: ToolCallStatus[]; structuredBlocks?: StructuredBlock[]; createdAt: string }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              timestamp: new Date(m.createdAt),
              toolCalls: m.toolCalls ?? undefined,
              structuredBlocks: m.structuredBlocks ?? undefined,
            }))
          );
        }
      }
    } catch {
      console.warn("[useChat] Failed to load conversation", convId);
    }
  };

  const ensureConversation = useCallback(async (firstMessage: string): Promise<string | null> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    if (creatingConversationRef.current) {
      // Wait for the in-flight creation to complete
      await new Promise((resolve) => setTimeout(resolve, 500));
      return conversationIdRef.current;
    }

    creatingConversationRef.current = true;
    try {
      // Strip event reference prefix for cleaner title
      const cleanMessage = firstMessage.replace(/\[Referencing event:.*?\]\s*/g, "").trim();
      const titleSource = cleanMessage || firstMessage;
      const title = titleSource.slice(0, 50) + (titleSource.length > 50 ? "..." : "");
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        const data = await res.json();
        const newId = data.conversation.id;
        conversationIdRef.current = newId;
        justCreatedRef.current = true;
        optionsRef.current?.onConversationCreated?.(newId);
        return newId;
      }
    } catch {
      console.warn("[useChat] Failed to create conversation");
    } finally {
      creatingConversationRef.current = false;
    }
    return null;
  }, []);

  const saveMessage = useCallback(async (convId: string, message: { role: string; content: string; toolCalls?: ToolCallStatus[]; structuredBlocks?: StructuredBlock[] }) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
      if (!res.ok) {
        console.warn("[useChat] Failed to save message:", res.status);
      }
    } catch {
      console.warn("[useChat] Failed to save message");
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      const asstId = generateId();

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Auto-create conversation if none exists
        const convId = await ensureConversation(userMsg.content);

        // Capture convId at send time — don't use conversationIdRef later (it might change if user switches)
        const saveConvId = convId;

        // Sliding window: only send the last 10 messages to the API
        const allMessages = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: userMsg.role, content: userMsg.content },
        ];
        const history = allMessages.slice(-10);

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            preferences,
            conversationId: saveConvId,
          }),
          signal: controller.signal,
        });

        if (res.status === 401) {
          const data = await res.json().catch(() => null);
          const isTokenExpired = data?.error === "token_expired";
          throw new AuthError(
            isTokenExpired
              ? "Your Google session has expired. Please sign in again to reconnect your calendar and email."
              : "You need to sign in to use the chat."
          );
        }
        if (!res.ok) throw new Error("Chat request failed");

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullText = "";
        let allToolCalls: ToolCallStatus[] = [];
        let allStructuredBlocks: StructuredBlock[] = [];
        let hadCalendarMutation = false;

        setMessages((prev) => [
          ...prev,
          { id: asstId, role: "assistant", content: "", timestamp: new Date() },
        ]);

        let reading = true;
        while (reading) {
          const { done, value } = await reader.read();
          if (done) {
            reading = false;
            break;
          }

          const rawChunk = decoder.decode(value, { stream: true });
          const { text, done: streamDone, authError, toolCalls, toolResults, structuredBlocks } = parseSSEChunk(rawChunk);

          if (authError) {
            throw new AuthError(authError);
          }

          if (toolCalls.length > 0) {
            allToolCalls = [...allToolCalls, ...toolCalls];
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstId ? { ...m, toolCalls: [...allToolCalls] } : m
              )
            );
          }

          if (toolResults.length > 0) {
            for (const result of toolResults) {
              allToolCalls = allToolCalls.map((tc) =>
                tc.id === result.id
                  ? { ...tc, status: result.error ? "error" as const : "done" as const, summary: result.summary, completedAt: Date.now() }
                  : tc
              );
              // Check if any calendar-mutating tool completed
              const toolCall = allToolCalls.find((tc) => tc.id === result.id);
              if (toolCall && CALENDAR_MUTATING_TOOLS.has(toolCall.name) && !result.error) {
                hadCalendarMutation = true;
              }
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstId ? { ...m, toolCalls: [...allToolCalls] } : m
              )
            );
          }

          if (structuredBlocks.length > 0) {
            allStructuredBlocks = [...allStructuredBlocks, ...structuredBlocks];
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstId ? { ...m, structuredBlocks: [...allStructuredBlocks] } : m
              )
            );
          }

          if (text) {
            fullText += text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstId ? { ...m, content: fullText } : m
              )
            );
          }

          if (streamDone) {
            reading = false;
          }
        }

        const textBlocks = parseStructuredBlocks(fullText);
        const finalBlocks = [...allStructuredBlocks, ...textBlocks];

        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstId
              ? {
                  ...m,
                  content: fullText,
                  structuredBlocks: finalBlocks.length > 0 ? finalBlocks : undefined,
                  toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
                }
              : m
          )
        );

        // Save messages to DB sequentially (user first, then assistant)
        if (saveConvId) {
          await saveMessage(saveConvId, { role: "user", content: userMsg.content });
          await saveMessage(saveConvId, {
            role: "assistant",
            content: fullText,
            toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
            structuredBlocks: finalBlocks.length > 0 ? finalBlocks : undefined,
          });
        }

        // Trigger calendar refresh if any mutating tool was used
        if (hadCalendarMutation) {
          optionsRef.current?.onCalendarMutation?.();
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;

        const isAuth = err instanceof AuthError;

        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== asstId);
          return [
            ...filtered,
            {
              id: asstId,
              role: "assistant" as const,
              content: isAuth
                ? err.message
                : "Sorry, I encountered an error. Please try again.",
              timestamp: new Date(),
              authError: isAuth || undefined,
            },
          ];
        });
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages, isLoading, preferences, saveMessage, ensureConversation]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    conversationIdRef.current = null;
  }, []);

  return { messages, sendMessage, isLoading, clearMessages };
}
