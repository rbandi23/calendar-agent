"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { CenterView, ContextPanelState, Conversation } from "@/types";

export interface AttachedEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
}

interface PanelContextValue {
  centerView: CenterView;
  setCenterView: (view: CenterView) => void;
  panelState: ContextPanelState;
  setPanelState: (state: ContextPanelState) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  conversations: Conversation[];
  setConversations: (convs: Conversation[]) => void;
  refreshConversations: () => void;
  setRefreshConversations: (fn: () => void) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;
  attachedEvents: AttachedEvent[];
  attachEvent: (event: AttachedEvent) => void;
  removeAttachedEvent: (id: string) => void;
  clearAttachedEvents: () => void;
  calendarRefreshKey: number;
  triggerCalendarRefresh: () => void;
}

const PanelContext = createContext<PanelContextValue | undefined>(undefined);

export function PanelProvider({ children }: { children: ReactNode }) {
  const [centerView, setCenterView] = useState<CenterView>("calendar");
  const [panelState, setPanelState] = useState<ContextPanelState>({
    mode: "empty",
  });
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshFn, setRefreshFn] = useState<() => void>(() => () => {});
  const [chatOpen, setChatOpen] = useState(true);
  const [attachedEvents, setAttachedEvents] = useState<AttachedEvent[]>([]);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  const handleSetCenterView = useCallback((view: CenterView) => {
    setCenterView(view);
  }, []);

  const handleSetPanelState = useCallback((state: ContextPanelState) => {
    setPanelState(state);
  }, []);

  const handleSetActiveConversationId = useCallback((id: string | null) => {
    setActiveConversationId(id);
  }, []);

  const handleSetConversations = useCallback((convs: Conversation[]) => {
    setConversations(convs);
  }, []);

  const handleSetRefreshConversations = useCallback((fn: () => void) => {
    setRefreshFn(() => fn);
  }, []);

  const toggleChat = useCallback(() => {
    setChatOpen((prev) => !prev);
  }, []);

  const attachEvent = useCallback((event: AttachedEvent) => {
    setAttachedEvents((prev) => {
      // Don't add duplicates
      if (prev.some((e) => e.id === event.id)) return prev;
      return [...prev, event];
    });
  }, []);

  const removeAttachedEvent = useCallback((id: string) => {
    setAttachedEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAttachedEvents = useCallback(() => {
    setAttachedEvents([]);
  }, []);

  const triggerCalendarRefresh = useCallback(() => {
    setCalendarRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <PanelContext.Provider
      value={{
        centerView,
        setCenterView: handleSetCenterView,
        panelState,
        setPanelState: handleSetPanelState,
        activeConversationId,
        setActiveConversationId: handleSetActiveConversationId,
        conversations,
        setConversations: handleSetConversations,
        refreshConversations: refreshFn,
        setRefreshConversations: handleSetRefreshConversations,
        chatOpen,
        setChatOpen,
        toggleChat,
        attachedEvents,
        attachEvent,
        removeAttachedEvent,
        clearAttachedEvents,
        calendarRefreshKey,
        triggerCalendarRefresh,
      }}
    >
      {children}
    </PanelContext.Provider>
  );
}

export function usePanel() {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error("usePanel must be used within a PanelProvider");
  }
  return context;
}
