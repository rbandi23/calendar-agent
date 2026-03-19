"use client";

import { format, parseISO } from "date-fns";
import { usePanel } from "@/context/panel-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { CalendarDays, Mail, Clock, Users } from "lucide-react";
import type { MeetingPrepData } from "@/types";

interface MeetingPrepCardProps {
  data: MeetingPrepData;
}

export function MeetingPrepCard({ data }: MeetingPrepCardProps) {
  const { setPanelState } = usePanel();
  const { event, recentEmails, suggestedActions, summary } = data;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 text-primary" />
          Meeting Prep
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Event Info */}
        <div className="flex flex-col gap-1">
          <p className="font-medium">{event.summary}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {event.start.dateTime
                ? format(parseISO(event.start.dateTime), "EEE, MMM d 'at' h:mm a")
                : event.start.date
                  ? format(parseISO(event.start.date), "EEE, MMM d") + " (All day)"
                  : "No time specified"}
            </span>
            {event.location && (
              <span className="truncate">{event.location}</span>
            )}
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {summary}
          </p>
        )}

        <Separator />

        {/* Attendees */}
        {event.attendees && event.attendees.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1 text-xs font-medium">
              <Users className="h-3 w-3" />
              Attendees ({event.attendees.length})
            </p>
            <div className="flex flex-col gap-1.5">
              {event.attendees.slice(0, 5).map((attendee, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback>
                      {(attendee.displayName || attendee.email)[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 truncate">
                    <p className="truncate text-xs font-medium">
                      {attendee.displayName || attendee.email}
                    </p>
                  </div>
                  {attendee.responseStatus && (
                    <Badge
                      variant={
                        attendee.responseStatus === "accepted"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-[10px]"
                    >
                      {attendee.responseStatus}
                    </Badge>
                  )}
                </div>
              ))}
              {event.attendees.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{event.attendees.length - 5} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Recent Emails */}
        {recentEmails.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-1 text-xs font-medium">
                <Mail className="h-3 w-3" />
                Recent Emails
              </p>
              {recentEmails.slice(0, 3).map((email, i) => (
                <div
                  key={i}
                  className="rounded-md bg-muted/50 p-2 text-xs"
                >
                  <p className="font-medium">{email.subject}</p>
                  <p className="mt-0.5 text-muted-foreground line-clamp-2">
                    {email.snippet}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Suggested Actions */}
        {suggestedActions.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-1.5">
              {suggestedActions.map((action, i) => (
                <Button
                  key={i}
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    if (action.toLowerCase().includes("email")) {
                      setPanelState({
                        mode: "draft",
                        draft: {
                          id: "",
                          to: event.attendees?.map((a) => a.email).join(", ") || "",
                          subject: `Re: ${event.summary}`,
                          body: "",
                        },
                      });
                    }
                  }}
                >
                  {action}
                </Button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
