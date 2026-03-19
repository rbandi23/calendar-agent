"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePanel } from "@/context/panel-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  CalendarDays,
  MessageSquare,
  Settings,
  LogOut,
} from "lucide-react";
import { SettingsDialog } from "@/components/settings/settings-dialog";

export function Sidebar() {
  const { data: session } = useSession();
  const { chatOpen, toggleChat } = usePanel();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <>
      <div className="flex h-full w-16 shrink-0 flex-col items-center border-r bg-card py-4">
        {/* Logo */}
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <CalendarDays className="h-4 w-4 text-primary-foreground" />
        </div>

        <Separator className="my-3 w-8" />

        {/* Navigation */}
        <nav className="flex flex-col items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            title="Calendar"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
          <Button
            variant={chatOpen ? "secondary" : "ghost"}
            size="icon"
            onClick={toggleChat}
            title="Toggle Chat"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full">
            <Avatar size="sm">
              {session?.user?.image && (
                <AvatarImage
                  src={session.user.image}
                  alt={session.user.name || "User"}
                />
              )}
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end">
            <DropdownMenuItem
              onClick={() =>
                signOut({ callbackUrl: "/" })
              }
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
