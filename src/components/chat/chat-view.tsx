"use client";

import { useRef, useEffect, useMemo } from "react";
import { useChat } from "@/hooks/use-chat";
import { usePreferences } from "@/context/preferences-context";
import { usePanel } from "@/context/panel-context";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageSquare } from "lucide-react";

export function ChatView() {
  const { preferences } = usePreferences();
  const { activeConversationId, setActiveConversationId, refreshConversations, triggerCalendarRefresh } = usePanel();

  const chatOptions = useMemo(
    () => ({
      conversationId: activeConversationId,
      onConversationCreated: (id: string) => {
        setActiveConversationId(id);
        refreshConversations();
      },
      onCalendarMutation: () => {
        triggerCalendarRefresh();
      },
    }),
    [activeConversationId, setActiveConversationId, refreshConversations, triggerCalendarRefresh]
  );

  const { messages, sendMessage, isLoading } = useChat(preferences, chatOptions);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Refresh sidebar conversation list after each message exchange
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      refreshConversations();
    }
  }, [isLoading, messages.length, refreshConversations]);

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="mb-1 text-lg font-medium">
                How can I help you today?
              </h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                I can help you schedule meetings, find free time, draft emails,
                prepare for meetings, and analyze your calendar.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading &&
                messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start">
                    <div className="rounded-lg bg-card px-4 py-3 ring-1 ring-foreground/10">
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-background">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <ChatInput onSend={sendMessage} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
