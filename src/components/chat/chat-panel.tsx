"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useChat } from "@/hooks/use-chat";
import { usePreferences } from "@/context/preferences-context";
import { usePanel } from "@/context/panel-context";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ChevronDown,
  MessageSquare,
  X,
} from "lucide-react";
import type { Conversation } from "@/types";

export function ChatPanel() {
  const { preferences } = usePreferences();
  const {
    activeConversationId,
    setActiveConversationId,
    conversations,
    refreshConversations,
    setChatOpen,
    triggerCalendarRefresh,
  } = usePanel();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showConversations, setShowConversations] = useState(false);

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

  // Auto-scroll to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Refresh conversation list after messages
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      refreshConversations();
    }
  }, [isLoading, messages.length, refreshConversations]);

  const handleNewConversation = async () => {
    setActiveConversationId(null);
    setShowConversations(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setShowConversations(false);
  };

  return (
    <div className="flex h-full w-[420px] shrink-0 flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">CHAT</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleNewConversation}
            title="New conversation"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowConversations(!showConversations)}
              title="Conversations"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>

            {/* Conversation dropdown */}
            {showConversations && (
              <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border bg-card shadow-lg">
                <div className="p-2">
                  <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">
                    Conversations
                  </p>
                  <div className="max-h-64 overflow-y-auto">
                    {conversations.length === 0 ? (
                      <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                        No conversations yet
                      </p>
                    ) : (
                      conversations.map((conv: Conversation) => (
                        <button
                          key={conv.id}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted ${
                            activeConversationId === conv.id
                              ? "bg-muted font-medium"
                              : ""
                          }`}
                          onClick={() => handleSelectConversation(conv.id)}
                        >
                          <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {conv.title || "New conversation"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setChatOpen(false)}
            title="Close chat"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Ask anything about your calendar...
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
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

      {/* Input — now using ChatInput with voice + drop support */}
      <div className="border-t p-3">
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}
