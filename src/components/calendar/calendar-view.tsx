"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  startOfWeek,
  endOfWeek,
  format,
} from "date-fns";
import { usePanel } from "@/context/panel-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { CalendarEvent } from "@/types";
import type { EventClickArg, DatesSetArg, EventMountArg } from "@fullcalendar/core";

type CalendarTab = "week" | "month";

export function CalendarView() {
  const { setPanelState, calendarRefreshKey } = usePanel();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<CalendarTab>("week");
  const calendarRef = useRef<FullCalendar>(null);
  const lastRangeRef = useRef<{ start: Date; end: Date } | null>(null);

  const fetchEvents = useCallback(async (rangeStart: Date, rangeEnd: Date) => {
    try {
      const params = new URLSearchParams({
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
      });

      const res = await fetch(`/api/calendar?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || data || []);
      }
    } catch {
      // Handle error silently
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch events when FullCalendar's visible date range changes
  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      setCurrentDate(arg.start);
      lastRangeRef.current = { start: arg.start, end: arg.end };
      fetchEvents(arg.start, arg.end);
    },
    [fetchEvents]
  );

  // Initial fetch
  useEffect(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    lastRangeRef.current = { start, end };
    fetchEvents(start, end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh when calendarRefreshKey changes (event created/rescheduled/cancelled from chat)
  useEffect(() => {
    if (calendarRefreshKey === 0) return; // skip initial
    if (lastRangeRef.current) {
      setRefreshing(true);
      fetchEvents(lastRangeRef.current.start, lastRangeRef.current.end);
    }
  }, [calendarRefreshKey, fetchEvents]);

  const handleManualRefresh = () => {
    if (lastRangeRef.current) {
      setRefreshing(true);
      fetchEvents(lastRangeRef.current.start, lastRangeRef.current.end);
    }
  };

  const handlePrev = () => {
    calendarRef.current?.getApi().prev();
  };

  const handleNext = () => {
    calendarRef.current?.getApi().next();
  };

  const handleToday = () => {
    calendarRef.current?.getApi().today();
  };

  const handleEventClick = (info: EventClickArg) => {
    setPanelState({ mode: "event", eventId: info.event.id });
  };

  // Make calendar events draggable to the chat input
  const handleEventDidMount = (info: EventMountArg) => {
    const el = info.el;
    el.setAttribute("draggable", "true");
    el.style.cursor = "grab";

    el.addEventListener("dragstart", (e: DragEvent) => {
      if (!e.dataTransfer) return;
      const eventData = JSON.stringify({
        id: info.event.id,
        summary: info.event.title,
        start: info.event.startStr,
        end: info.event.endStr,
      });
      e.dataTransfer.setData("application/calendar-event", eventData);
      e.dataTransfer.effectAllowed = "copy";

      // Custom drag image
      const ghost = document.createElement("div");
      ghost.textContent = info.event.title;
      ghost.style.cssText =
        "position:absolute;top:-1000px;padding:6px 12px;background:#3b82f6;color:#fff;border-radius:6px;font-size:13px;font-weight:500;white-space:nowrap;";
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      setTimeout(() => document.body.removeChild(ghost), 0);
    });
  };

  const handleTabChange = (tab: CalendarTab) => {
    setActiveTab(tab);
    if (tab === "week") {
      calendarRef.current?.getApi().changeView("timeGridWeek");
    } else if (tab === "month") {
      calendarRef.current?.getApi().changeView("dayGridMonth");
    }
  };

  const isFocusEvent = (title: string) => {
    const lower = title.toLowerCase();
    return lower.includes("focus") || lower.includes("block");
  };

  const calendarEvents = events.map((evt) => ({
    id: evt.id,
    title: evt.summary,
    start: evt.start.dateTime ?? evt.start.date,
    end: evt.end.dateTime ?? evt.end.date,
    allDay: !evt.start.dateTime,
    backgroundColor: isFocusEvent(evt.summary || "")
      ? "rgb(34, 197, 94)"
      : "rgb(59, 130, 246)",
    borderColor: isFocusEvent(evt.summary || "")
      ? "rgb(22, 163, 74)"
      : "rgb(37, 99, 235)",
    textColor: "#fff",
  }));

  const calApi = calendarRef.current?.getApi();
  const displayDate = calApi ? calApi.getDate() : currentDate;
  const dateLabel =
    activeTab === "month"
      ? format(displayDate, "MMMM yyyy")
      : `${format(startOfWeek(displayDate, { weekStartsOn: 1 }), "MMM d")} - ${format(endOfWeek(displayDate, { weekStartsOn: 1 }), "MMM d, yyyy")}`;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium">{dateLabel}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleManualRefresh}
            disabled={refreshing}
            title="Refresh calendar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={activeTab === "week" ? "secondary" : "outline"}
            size="sm"
            onClick={() => handleTabChange("week")}
          >
            Week
          </Button>
          <Button
            variant={activeTab === "month" ? "secondary" : "outline"}
            size="sm"
            onClick={() => handleTabChange("month")}
          >
            Month
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-auto p-4">
        {initialLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-[500px] w-full" />
          </div>
        ) : (
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={false}
            events={calendarEvents}
            eventClick={handleEventClick}
            eventDidMount={handleEventDidMount}
            datesSet={handleDatesSet}
            height="auto"
            nowIndicator
            allDaySlot={true}
            slotMinTime="07:00:00"
            slotMaxTime="21:00:00"
            weekends
            firstDay={1}
            eventDisplay="block"
            slotDuration="00:30:00"
          />
        )}
      </div>
    </div>
  );
}
