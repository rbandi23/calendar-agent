"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { usePanel } from "@/context/panel-context";
import type { TimeSlot } from "@/types";

interface TimeSlotCardProps {
  slots: TimeSlot[];
}

export function TimeSlotCard({ slots }: TimeSlotCardProps) {
  const [bookingSlot, setBookingSlot] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<Map<string, string>>(new Map());
  const [conflictSlot, setConflictSlot] = useState<string | null>(null);
  const { setPanelState, triggerCalendarRefresh } = usePanel();

  const checkConflicts = async (slot: TimeSlot): Promise<boolean> => {
    try {
      const res = await fetch("/api/calendar/freebusy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeMin: slot.start,
          timeMax: slot.end,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const freeBusy = data.freeBusy ?? data;
        const calendars = freeBusy.calendars ?? {};
        // Check if there are any busy blocks in the requested time range
        for (const cal of Object.values(calendars) as { busy?: { start: string; end: string }[] }[]) {
          if (cal.busy && cal.busy.length > 0) {
            return true; // has conflict
          }
        }
      }
    } catch {
      // If conflict check fails, allow booking (fail open)
    }
    return false;
  };

  const handleBook = async (slot: TimeSlot, force = false) => {
    const key = `${slot.start}-${slot.end}`;
    setBookingSlot(key);
    setConflictSlot(null);

    try {
      // Check for conflicts before booking (unless force=true)
      if (!force) {
        const hasConflict = await checkConflicts(slot);
        if (hasConflict) {
          setConflictSlot(key);
          setBookingSlot(null);
          return;
        }
      }

      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: slot.label || "Meeting",
          start: { dateTime: slot.start },
          end: { dateTime: slot.end },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const eventId = data.id || data.event?.id;
        setBookedSlots((prev) => new Map(prev).set(key, eventId || ""));
        setConflictSlot(null);
        triggerCalendarRefresh();
        if (eventId) {
          setPanelState({ mode: "event", eventId });
        }
      }
    } catch {
      // Handle error silently
    } finally {
      setBookingSlot(null);
    }
  };

  const handleViewEvent = (eventId: string) => {
    if (eventId) {
      setPanelState({ mode: "event", eventId });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">
        Available time slots
      </p>
      {slots.map((slot, i) => {
        const key = `${slot.start}-${slot.end}`;
        const bookedEventId = bookedSlots.get(key);
        const isBooked = bookedEventId !== undefined;
        const isBooking = bookingSlot === key;
        const hasConflict = conflictSlot === key;

        return (
          <Card key={i} size="sm">
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {format(parseISO(slot.start), "EEE, MMM d")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(slot.start), "h:mm a")} -{" "}
                      {format(parseISO(slot.end), "h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {slot.label && (
                    <Badge variant="secondary" className="text-xs">
                      {slot.label}
                    </Badge>
                  )}
                  {isBooked ? (
                    <div className="flex items-center gap-1">
                      <Button size="xs" variant="ghost" disabled>
                        <Check className="mr-1 h-3 w-3 text-green-500" />
                        Booked
                      </Button>
                      {bookedEventId && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleViewEvent(bookedEventId)}
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          View
                        </Button>
                      )}
                    </div>
                  ) : hasConflict ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => handleBook(slot, true)}
                      >
                        Book anyway
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="xs"
                      onClick={() => handleBook(slot)}
                      disabled={isBooking}
                    >
                      {isBooking && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      Book
                    </Button>
                  )}
                </div>
              </div>
              {hasConflict && (
                <div className="flex items-center gap-1.5 rounded-md bg-yellow-500/10 px-2.5 py-1.5 text-xs text-yellow-300">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  You already have something at this time. Book anyway?
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
