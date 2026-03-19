"use client";

import { usePanel } from "@/context/panel-context";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { EventDetails } from "@/components/context/event-details";
import { DraftEditor } from "@/components/context/draft-editor";

export function ContextPanel() {
  const { panelState, setPanelState } = usePanel();

  if (panelState.mode === "empty") return null;

  const titleMap: Record<string, string> = {
    event: "Event Details",
    draft: "Email Draft",
    scheduling: "Scheduling",
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">
          {titleMap[panelState.mode] || "Details"}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setPanelState({ mode: "empty" })}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          {panelState.mode === "event" && (
            <EventDetails eventId={panelState.eventId} />
          )}
          {panelState.mode === "draft" && (
            <DraftEditor initialDraft={panelState.draft} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
