"use client";

import { useState, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface CalendarEvent {
  id: string;
  date: Date;
  label: string;
  color: string;
  type?: string;
  sublabel?: string;
  details?: Record<string, string>;
}

type ViewMode = "day" | "week" | "month";

interface Props {
  events: CalendarEvent[];
}

const VIEW_LABELS: Record<ViewMode, string> = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
};

const WORK_HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8h - 19h

// ── Clickable Event Chip ────────────────────────────────

function EventChip({
  ev,
  size = "sm",
}: {
  ev: CalendarEvent;
  size?: "xs" | "sm";
}) {
  const isXs = size === "xs";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`rounded font-medium text-white truncate leading-tight text-left w-full cursor-pointer hover:brightness-110 transition-all ${
            isXs ? "px-1 py-0.5 text-[9px]" : "px-2 py-1.5 text-xs"
          }`}
          style={{ backgroundColor: ev.color }}
        >
          {!isXs && ev.sublabel && (
            <span className="opacity-80">{ev.sublabel} </span>
          )}
          {ev.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div
          className="px-4 py-3 rounded-t-lg"
          style={{ backgroundColor: ev.color }}
        >
          <h4 className="text-sm font-semibold text-white">{ev.label}</h4>
          {ev.sublabel && (
            <p className="text-xs text-white/80 mt-0.5">{ev.sublabel}</p>
          )}
        </div>
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Date :</span>
            <span className="font-medium">
              {format(new Date(ev.date), "EEEE d MMMM yyyy", { locale: fr })}
            </span>
          </div>
          {ev.details &&
            Object.entries(ev.details).map(([key, value]) =>
              value ? (
                <div key={key} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0">{key} :</span>
                  <span className="font-medium">{value}</span>
                </div>
              ) : null
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main Component ──────────────────────────────────────

export function CalendarView({ events }: Props) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  const navigate = (dir: -1 | 1) => {
    setCurrentDate((d) => {
      switch (viewMode) {
        case "month":
          return dir === 1 ? addMonths(d, 1) : subMonths(d, 1);
        case "week":
          return dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1);
        case "day":
          return dir === 1 ? addDays(d, 1) : subDays(d, 1);
      }
    });
  };

  const goToday = () => setCurrentDate(new Date());

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = format(new Date(ev.date), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const headerTitle = useMemo(() => {
    switch (viewMode) {
      case "month":
        return format(currentDate, "MMMM yyyy", { locale: fr });
      case "week": {
        const ws = startOfWeek(currentDate, { locale: fr });
        const we = endOfWeek(currentDate, { locale: fr });
        return `${format(ws, "d MMM", { locale: fr })} — ${format(we, "d MMM yyyy", { locale: fr })}`;
      }
      case "day":
        return format(currentDate, "EEEE d MMMM yyyy", { locale: fr });
    }
  }, [currentDate, viewMode]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => navigate(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="ml-1 text-xs h-7"
            onClick={goToday}
          >
            Aujourd&apos;hui
          </Button>
        </div>

        <h3 className="text-sm font-semibold capitalize">{headerTitle}</h3>

        <div className="flex rounded-lg border overflow-hidden">
          {(["day", "week", "month"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-muted-foreground"
              }`}
            >
              {VIEW_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "month" && (
        <MonthView currentDate={currentDate} eventsByDay={eventsByDay} />
      )}
      {viewMode === "week" && (
        <WeekView currentDate={currentDate} eventsByDay={eventsByDay} />
      )}
      {viewMode === "day" && (
        <DayView currentDate={currentDate} eventsByDay={eventsByDay} />
      )}
    </div>
  );
}

// ── Month View ──────────────────────────────────────────

function MonthView({
  currentDate,
  eventsByDay,
}: {
  currentDate: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
}) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { locale: fr });
    const calEnd = endOfWeek(monthEnd, { locale: fr });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate]);

  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div className="grid grid-cols-7 border rounded-lg overflow-hidden">
      {weekDays.map((d) => (
        <div
          key={d}
          className="px-1 py-2 text-center text-[10px] font-semibold text-muted-foreground bg-muted/50 border-b"
        >
          {d}
        </div>
      ))}
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const dayEvents = eventsByDay.get(key) ?? [];
        const inMonth = isSameMonth(day, currentDate);
        const today = isToday(day);

        return (
          <div
            key={key}
            className={`min-h-[5rem] border-b border-r p-1 ${
              !inMonth ? "bg-muted/30" : ""
            } ${today ? "bg-primary/5" : ""}`}
          >
            <div
              className={`text-[11px] font-medium mb-0.5 ${
                !inMonth
                  ? "text-muted-foreground/40"
                  : today
                    ? "text-primary font-bold"
                    : "text-muted-foreground"
              }`}
            >
              {format(day, "d")}
            </div>
            <div className="space-y-0.5">
              {dayEvents.slice(0, 3).map((ev) => (
                <EventChip key={ev.id} ev={ev} size="xs" />
              ))}
              {dayEvents.length > 3 && (
                <div className="text-[9px] text-muted-foreground pl-1">
                  +{dayEvents.length - 3} autre(s)
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Week View ───────────────────────────────────────────

function WeekView({
  currentDate,
  eventsByDay,
}: {
  currentDate: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
}) {
  const weekStart = startOfWeek(currentDate, { locale: fr });
  const weekEnd = endOfWeek(currentDate, { locale: fr });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-muted/50 border-b">
        <div className="px-1 py-2 text-center text-[10px] font-semibold text-muted-foreground" />
        {days.map((day) => {
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`px-1 py-2 text-center border-l ${today ? "bg-primary/10" : ""}`}
            >
              <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                {format(day, "EEE", { locale: fr })}
              </div>
              <div
                className={`text-sm font-bold ${today ? "text-primary" : ""}`}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] max-h-[500px] overflow-y-auto">
        {WORK_HOURS.map((hour) => (
          <div key={hour} className="contents">
            <div className="px-2 py-3 text-[10px] text-muted-foreground text-right border-b border-r">
              {String(hour).padStart(2, "0")}:00
            </div>
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDay.get(key) ?? [];
              // Show events in the 8h slot
              const slotEvents = hour === 8 ? dayEvents : [];
              const today = isToday(day);

              return (
                <div
                  key={`${key}-${hour}`}
                  className={`border-b border-l min-h-[3rem] p-0.5 ${today ? "bg-primary/5" : ""}`}
                >
                  {slotEvents.map((ev) => (
                    <div key={ev.id} className="mb-0.5">
                      <EventChip ev={ev} size="xs" />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Day View ────────────────────────────────────────────

function DayView({
  currentDate,
  eventsByDay,
}: {
  currentDate: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
}) {
  const key = format(currentDate, "yyyy-MM-dd");
  const dayEvents = eventsByDay.get(key) ?? [];
  const today = isToday(currentDate);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Day header */}
      <div
        className={`px-4 py-3 border-b ${today ? "bg-primary/10" : "bg-muted/50"}`}
      >
        <div className="text-xs font-semibold text-muted-foreground uppercase">
          {format(currentDate, "EEEE", { locale: fr })}
        </div>
        <div className={`text-lg font-bold ${today ? "text-primary" : ""}`}>
          {format(currentDate, "d MMMM yyyy", { locale: fr })}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {dayEvents.length} événement{dayEvents.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Time slots */}
      <div className="max-h-[500px] overflow-y-auto">
        {WORK_HOURS.map((hour) => {
          const slotEvents = hour === 8 ? dayEvents : [];

          return (
            <div key={hour} className="flex border-b">
              <div className="w-[60px] shrink-0 px-2 py-3 text-[11px] text-muted-foreground text-right border-r">
                {String(hour).padStart(2, "0")}:00
              </div>
              <div className="flex-1 p-1 min-h-[3rem]">
                {slotEvents.map((ev) => (
                  <div key={ev.id} className="mb-1">
                    <EventChip ev={ev} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
