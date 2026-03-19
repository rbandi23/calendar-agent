"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { useSession } from "next-auth/react";
import { usePanel } from "@/context/panel-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Clock,
  MapPin,
  FileText,
  Users,
  Mail,
  Briefcase,
} from "lucide-react";
import type { CalendarEvent } from "@/types";
import type { AttachedEvent } from "@/context/panel-context";

interface EventDetailsProps {
  eventId: string;
}

export function EventDetails({ eventId }: EventDetailsProps) {
  const { data: session } = useSession();
  const { setCenterView, setPanelState, setChatOpen, attachEvent } = usePanel();
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvent() {
      setLoading(true);
      try {
        const res = await fetch(`/api/calendar/${eventId}`);
        if (res.ok) {
          const data = await res.json();
          setEvent(data.event ?? data);
        }
      } catch {
        // Handle error silently
      } finally {
        setLoading(false);
      }
    }
    fetchEvent();
  }, [eventId]);

  const handleEmailAttendees = () => {
    if (!event) return;
    const userEmail = session?.user?.email;
    const attendeeEmails = event.attendees
      ?.map((a) => a.email)
      .filter((email) => email !== userEmail) || [];
    setPanelState({
      mode: "draft",
      draft: {
        id: "",
        to: attendeeEmails.join(", "),
        subject: `Re: ${event.summary}`,
        body: "",
      },
    });
  };

  const handlePrepForMeeting = () => {
    if (!event) return;

    // Attach event to chat so the AI gets the context
    const startStr = event.start.dateTime ?? event.start.date ?? "";
    const endStr = event.end.dateTime ?? event.end.date ?? "";
    attachEvent({
      id: event.id,
      summary: event.summary,
      start: startStr,
      end: endStr,
    });

    // Auto-send a prep request via a custom event that ChatInput listens for
    window.dispatchEvent(
      new CustomEvent("auto-send-chat", {
        detail: `Prep me for my meeting "${event.summary}"`,
      })
    );

    // Open chat and close context panel
    setChatOpen(true);
    setPanelState({ mode: "empty" });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <p className="text-sm text-muted-foreground">Event not found.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Title */}
      <div>
        <h3 className="text-base font-semibold">{event.summary}</h3>
        {event.status && (
          <Badge variant="outline" className="mt-1 text-xs">
            {event.status}
          </Badge>
        )}
      </div>

      {/* Time */}
      <div className="flex items-start gap-2 text-sm">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          {event.start?.dateTime ? (
            <>
              <p>{format(parseISO(event.start.dateTime), "EEEE, MMMM d, yyyy")}</p>
              <p className="text-muted-foreground">
                {format(parseISO(event.start.dateTime), "h:mm a")} -{" "}
                {event.end?.dateTime
                  ? format(parseISO(event.end.dateTime), "h:mm a")
                  : ""}
              </p>
            </>
          ) : event.start?.date ? (
            <p>{format(parseISO(event.start.date), "EEEE, MMMM d, yyyy")} (All day)</p>
          ) : (
            <p className="text-muted-foreground">No time specified</p>
          )}
        </div>
      </div>

      {/* Location */}
      {event.location && (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p>{event.location}</p>
        </div>
      )}

      {/* Description */}
      {event.description && (
        <div className="flex items-start gap-2 text-sm">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="whitespace-pre-wrap text-muted-foreground">
            {event.description}
          </p>
        </div>
      )}

      {/* Attendees */}
      {event.attendees && event.attendees.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Users className="h-3 w-3" />
              Attendees ({event.attendees.length})
            </p>
            <div className="flex flex-col gap-2">
              {event.attendees.map((attendee, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback>
                      {(
                        attendee.displayName ||
                        attendee.email
                      )[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 truncate">
                    <p className="truncate text-xs font-medium">
                      {attendee.displayName || attendee.email}
                    </p>
                    {attendee.displayName && (
                      <p className="truncate text-[10px] text-muted-foreground">
                        {attendee.email}
                      </p>
                    )}
                  </div>
                  {attendee.responseStatus && (
                    <Badge
                      variant={
                        attendee.responseStatus === "accepted"
                          ? "secondary"
                          : attendee.responseStatus === "declined"
                            ? "destructive"
                            : "outline"
                      }
                      className="text-[10px]"
                    >
                      {attendee.responseStatus}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <Separator />
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="justify-start gap-2"
          onClick={handleEmailAttendees}
        >
          <Mail className="h-3.5 w-3.5" />
          Email attendees
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-start gap-2"
          onClick={handlePrepForMeeting}
        >
          <Briefcase className="h-3.5 w-3.5" />
          Prep for meeting
        </Button>
      </div>
    </div>
  );
}
