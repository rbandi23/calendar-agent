"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, Loader2, ExternalLink } from "lucide-react";
import { usePanel } from "@/context/panel-context";
import type { TimeSlot } from "@/types";

interface TimeSlotCardProps {
  slots: TimeSlot[];
}

export function TimeSlotCard({ slots }: TimeSlotCardProps) {
  const [bookingSlot, setBookingSlot] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<Map<string, string>>(new Map());
  const { setPanelState, triggerCalendarRefresh } = usePanel();

  const handleBook = async (slot: TimeSlot) => {
    const key = `${slot.start}-${slot.end}`;
    setBookingSlot(key);

    try {
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
        // Open event details in context panel + refresh calendar
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

        return (
          <Card key={i} size="sm">
            <CardContent className="flex items-center justify-between gap-3">
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
