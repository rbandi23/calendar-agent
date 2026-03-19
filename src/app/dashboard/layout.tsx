"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useCallback } from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelProvider, usePanel } from "@/context/panel-context";
import { PreferencesProvider } from "@/context/preferences-context";
import { Sidebar } from "@/components/layout/sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ContextPanel } from "@/components/layout/context-panel";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const {
    chatOpen,
    setChatOpen,
    panelState,
    setConversations,
    setRefreshConversations,
  } = usePanel();

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      } else {
        console.warn("[DashboardShell] Failed to fetch conversations:", res.status);
      }
    } catch (err) {
      console.warn("[DashboardShell] Failed to fetch conversations:", err);
    }
  }, [setConversations]);

  // Fetch conversations on mount + retry once after short delay (in case auth isn't ready)
  useEffect(() => {
    fetchConversations();
    setRefreshConversations(fetchConversations);

    const retryTimer = setTimeout(fetchConversations, 2000);
    return () => clearTimeout(retryTimer);
  }, [fetchConversations, setRefreshConversations]);

  // Auto-open chat when an event is dragged over the chat area
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("application/calendar-event")) return;
      if (!chatOpen) {
        setChatOpen(true);
      }
    };
    window.addEventListener("dragover", handleDragOver);
    return () => window.removeEventListener("dragover", handleDragOver);
  }, [chatOpen, setChatOpen]);

  const showContextPanel = panelState.mode !== "empty";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
      {chatOpen && <ChatPanel />}
      {showContextPanel && (
        <div className="w-[320px] shrink-0 border-l bg-background">
          <ContextPanel />
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <PanelProvider>
      <PreferencesProvider>
        {session?.error === "RefreshTokenError" && (
          <div className="flex items-center justify-center gap-3 border-b border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-200">
            <span>Your Google session has expired.</span>
            <Button
              size="xs"
              variant="outline"
              className="gap-1.5 border-yellow-500/30 text-yellow-200 hover:bg-yellow-500/20"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            >
              <LogIn className="h-3 w-3" />
              Sign in again
            </Button>
          </div>
        )}
        <DashboardShell>{children}</DashboardShell>
      </PreferencesProvider>
    </PanelProvider>
  );
}
