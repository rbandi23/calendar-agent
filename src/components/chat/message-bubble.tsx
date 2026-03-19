"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import type { ChatMessage, StructuredBlock, ToolCallStatus } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TimeSlotCard } from "@/components/chat/structured-responses/time-slot-card";
import { DraftPreview } from "@/components/chat/structured-responses/draft-preview";
import { AnalyticsChart } from "@/components/chat/structured-responses/analytics-chart";
import { MeetingPrepCard } from "@/components/chat/structured-responses/meeting-prep-card";
import {
  ChevronRight,
  Loader2,
  Calendar,
  Mail,
  Users,
  BarChart3,
  Briefcase,
  Settings,
  Search,
  FileEdit,
  CheckCircle2,
  XCircle,
  Clock,
  LogIn,
} from "lucide-react";

function removeStructuredBlocks(content: string): string {
  return content
    .replace(/:::(timeslots|draft|analytics|meetingprep)\s+[\s\S]*?:::/g, "")
    .trim();
}

function renderBlock(block: StructuredBlock, index: number) {
  switch (block.type) {
    case "timeslots":
      return <TimeSlotCard key={index} slots={block.data} />;
    case "draft":
      return <DraftPreview key={index} draft={block.data} />;
    case "analytics":
      return <AnalyticsChart key={index} data={block.data} />;
    case "meetingprep":
      return <MeetingPrepCard key={index} data={block.data} />;
    default:
      return null;
  }
}

const TOOL_META: Record<string, { icon: typeof Calendar; label: string; activeLabel: string }> = {
  list_calendar_events: { icon: Calendar, label: "Checked calendar", activeLabel: "Checking calendar..." },
  get_event_details: { icon: Calendar, label: "Got event details", activeLabel: "Fetching event details..." },
  create_calendar_event: { icon: Calendar, label: "Created event", activeLabel: "Creating event..." },
  get_free_busy: { icon: Clock, label: "Checked availability", activeLabel: "Checking availability..." },
  search_emails: { icon: Search, label: "Searched emails", activeLabel: "Searching emails..." },
  propose_email: { icon: FileEdit, label: "Drafted email", activeLabel: "Drafting email..." },
  search_contacts: { icon: Users, label: "Searched contacts", activeLabel: "Searching contacts..." },
  analyze_meeting_time: { icon: BarChart3, label: "Analyzed calendar", activeLabel: "Analyzing calendar..." },
  get_user_preferences: { icon: Settings, label: "Loaded preferences", activeLabel: "Loading preferences..." },
  prep_for_meeting: { icon: Briefcase, label: "Prepared meeting brief", activeLabel: "Preparing meeting brief..." },
};

function getToolMeta(name: string) {
  return TOOL_META[name] ?? { icon: Settings, label: name, activeLabel: `Running ${name}...` };
}

function formatDuration(startedAt?: number, completedAt?: number): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = completedAt - startedAt;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatToolArgs(name: string, args: Record<string, unknown>): string | null {
  switch (name) {
    case "list_calendar_events": {
      const min = args.timeMin as string | undefined;
      const max = args.timeMax as string | undefined;
      if (min && max) {
        try {
          const start = new Date(min).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const end = new Date(max).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return start === end ? start : `${start} – ${end}`;
        } catch { return null; }
      }
      return null;
    }
    case "search_emails":
      return args.query ? `"${args.query}"` : null;
    case "search_contacts":
      return args.query ? `"${args.query}"` : null;
    case "get_free_busy": {
      const attendees = args.attendees as string[] | undefined;
      if (attendees && attendees.length > 0) {
        return `${attendees.length} ${attendees.length === 1 ? "person" : "people"}`;
      }
      return "your calendar";
    }
    case "analyze_meeting_time": {
      const min = args.timeMin as string | undefined;
      const max = args.timeMax as string | undefined;
      if (min && max) {
        try {
          const start = new Date(min).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const end = new Date(max).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return `${start} – ${end}`;
        } catch { return null; }
      }
      return null;
    }
    default:
      return null;
  }
}

function ThoughtProcess({ toolCalls }: { toolCalls: ToolCallStatus[] }) {
  const [expanded, setExpanded] = useState(false);
  const allDone = toolCalls.every((tc) => tc.status === "done" || tc.status === "error");
  const hasPending = toolCalls.some((tc) => tc.status === "pending");
  const errorCount = toolCalls.filter((tc) => tc.status === "error").length;

  // Auto-expand while running, stay expanded if user manually expanded
  const [userToggled, setUserToggled] = useState(false);

  useEffect(() => {
    if (!userToggled) {
      setExpanded(hasPending);
    }
  }, [hasPending, userToggled]);

  const handleToggle = () => {
    setUserToggled(true);
    setExpanded(!expanded);
  };

  // Group tool calls into parallel batches (calls with startedAt within 50ms of each other)
  const batches: ToolCallStatus[][] = [];
  const sorted = [...toolCalls].sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
  for (const tc of sorted) {
    const lastBatch = batches[batches.length - 1];
    if (lastBatch && tc.startedAt && lastBatch[0].startedAt &&
        Math.abs(tc.startedAt - lastBatch[0].startedAt) < 100) {
      lastBatch.push(tc);
    } else {
      batches.push([tc]);
    }
  }

  return (
    <div className="mb-3">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            expanded && "rotate-90"
          )}
        />
        {hasPending ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
            <span className="text-blue-400 font-medium">
              {toolCalls.find((tc) => tc.status === "pending")
                ? getToolMeta(toolCalls.find((tc) => tc.status === "pending")!.name).activeLabel
                : "Thinking..."}
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            {errorCount > 0 ? (
              <XCircle className="h-3 w-3 text-red-400" />
            ) : (
              <CheckCircle2 className="h-3 w-3 text-green-400" />
            )}
            <span>
              {errorCount > 0
                ? `Completed with ${errorCount} ${errorCount === 1 ? "error" : "errors"}`
                : `Analyzed ${toolCalls.length} ${toolCalls.length === 1 ? "source" : "sources"}`}
            </span>
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-2 ml-1.5 border-l-2 border-muted pl-3 flex flex-col gap-0.5">
          {batches.map((batch, batchIdx) => (
            <div key={batchIdx} className="flex flex-col gap-0.5">
              {batch.length > 1 && (
                <div className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mt-1 first:mt-0">
                  parallel
                </div>
              )}
              {batch.map((tc) => {
                const meta = getToolMeta(tc.name);
                const Icon = meta.icon;
                const duration = formatDuration(tc.startedAt, tc.completedAt);
                const argHint = formatToolArgs(tc.name, tc.args);

                return (
                  <div
                    key={tc.id}
                    className={cn(
                      "flex items-center gap-2 py-1 px-2 rounded-md text-xs transition-all duration-300",
                      tc.status === "pending" && "bg-blue-500/5 text-blue-300",
                      tc.status === "done" && "text-muted-foreground",
                      tc.status === "error" && "bg-red-500/5 text-red-400"
                    )}
                  >
                    {tc.status === "pending" ? (
                      <Loader2 className="h-3 w-3 animate-spin shrink-0 text-blue-400" />
                    ) : tc.status === "done" ? (
                      <Icon className="h-3 w-3 shrink-0 text-green-400/70" />
                    ) : (
                      <XCircle className="h-3 w-3 shrink-0 text-red-400" />
                    )}

                    <span className={cn(
                      "font-medium",
                      tc.status === "pending" && "text-blue-300"
                    )}>
                      {tc.status === "pending" ? meta.activeLabel : meta.label}
                    </span>

                    {argHint && (
                      <span className="text-muted-foreground/50">
                        {argHint}
                      </span>
                    )}

                    {tc.summary && tc.status === "done" && (
                      <span className="text-muted-foreground/50">
                        — {tc.summary}
                      </span>
                    )}

                    {duration && (
                      <span className="ml-auto text-[10px] text-muted-foreground/30 tabular-nums">
                        {duration}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const textContent = message.structuredBlocks
    ? removeStructuredBlocks(message.content)
    : message.content;

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          <div className="whitespace-pre-wrap leading-relaxed">{textContent}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[95%] text-sm">
        {/* Thought process (replaces tool call cards) */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ThoughtProcess toolCalls={message.toolCalls} />
        )}

        {textContent && (
          <div className="whitespace-pre-wrap leading-relaxed">
            {textContent}
          </div>
        )}
        {message.authError && (
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign in again
            </Button>
          </div>
        )}
        {message.structuredBlocks && message.structuredBlocks.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {message.structuredBlocks.map((block, i) => renderBlock(block, i))}
          </div>
        )}
      </div>
    </div>
  );
}
