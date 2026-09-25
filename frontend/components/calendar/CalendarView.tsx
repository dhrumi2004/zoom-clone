"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { ScheduleMeetingDialog } from "@/components/meetings/ScheduleMeetingDialog";
import { Button } from "@/components/ui/Button";
import { useNow } from "@/hooks/useNow";
import { api } from "@/lib/api";
import { formatTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { addDays, HOUR_PX, layoutLanes, meetingSpan, sameDay, startOfDay, startOfWeek } from "./calendarMath";
import { MeetingDetailsDialog } from "./MeetingDetailsDialog";

type View = "week" | "day";
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Zoom Calendar: week (or day) grid with your meetings. Click a slot to schedule, click a meeting for details. */
export function CalendarView() {
  const now = useNow();
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState<View>("week");
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [schedule, setSchedule] = useState<{ start: Date | null; meeting: Meeting | null } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rangeStart = view === "week" ? startOfWeek(anchor) : anchor;
  const days = Array.from({ length: view === "week" ? 7 : 1 }, (_, i) => addDays(rangeStart, i));
  const rangeEnd = addDays(rangeStart, days.length);
  const { data: meetings } = useSWR(["calendar", rangeStart.toISOString(), view], () => api.getCalendar(rangeStart, rangeEnd));

  // Phones only have room for one day.
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const apply = () => setView((v) => (media.matches ? "day" : v));
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  // Start scrolled to 8 AM, like Zoom (once the grid has rendered).
  const ready = now !== null;
  useEffect(() => {
    if (ready) scrollRef.current?.scrollTo({ top: HOUR_PX * 8 - 8 });
  }, [ready]);

  const step = (dir: number) => setAnchor((a) => addDays(a, dir * days.length));
  const title =
    view === "week"
      ? `${rangeStart.toLocaleDateString([], { month: "short", day: "numeric" })} – ${addDays(rangeEnd, -1).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`
      : anchor.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Dates and times are formatted in the viewer's locale and time zone, so render only in the browser.
  if (!now) return <div className="m-4 h-[70vh] animate-pulse rounded-xl bg-surface-hover" />;

  const openSlot = (day: Date, hour: number) => {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    if (now && start.getTime() + 60 * 60_000 <= now.getTime()) return; // that hour is already over
    // The current hour has partly passed: fall back to the next half hour.
    setSchedule({ start: now && start < now ? null : start, meeting: null });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Button variant="secondary" size="sm" onClick={() => setAnchor(startOfDay(new Date()))}>
          Today
        </Button>
        <div className="flex">
          <button type="button" aria-label="Previous" onClick={() => step(-1)} className="rounded-lg p-1.5 hover:bg-surface-hover">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" aria-label="Next" onClick={() => step(1)} className="rounded-lg p-1.5 hover:bg-surface-hover">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>
        <div className="hidden rounded-lg border border-line p-0.5 md:flex">
          {(["day", "week"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={clsx("rounded-md px-3 py-1 text-sm capitalize", view === v ? "bg-zoom-blue-soft font-bold text-zoom-blue" : "hover:bg-surface-hover")}
            >
              {v}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setSchedule({ start: null, meeting: null })}>
          <Plus className="size-4" /> Schedule
        </Button>
      </div>

      {/* Day headers */}
      <div className="flex overflow-y-hidden border-b border-line [scrollbar-gutter:stable]">
        <div className="w-14 shrink-0" />
        {days.map((d) => {
          const today = now ? sameDay(d, now) : false;
          return (
            <div key={d.toISOString()} className="flex-1 border-l border-line py-2 text-center">
              <p className={clsx("text-xs", today ? "font-bold text-zoom-blue" : "text-ink-muted")}>
                {d.toLocaleDateString([], { weekday: "short" })}
              </p>
              <p
                className={clsx(
                  "mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full text-lg",
                  today ? "bg-zoom-blue font-bold text-white" : "text-ink",
                )}
              >
                {d.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Hour grid */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="relative flex" style={{ height: HOUR_PX * 24 }}>
          <div className="w-14 shrink-0">
            {HOURS.map((h) => (
              <div key={h} className="relative text-right text-[10px] text-ink-muted" style={{ height: HOUR_PX }}>
                {h > 0 && (
                  <span className="absolute -top-2 right-2">
                    {new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" })}
                  </span>
                )}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayMeetings = (meetings ?? []).filter((m) => sameDay(meetingSpan(m).start, day));
            const lanes = layoutLanes(dayMeetings);
            const isToday = now ? sameDay(day, now) : false;
            return (
              <div key={day.toISOString()} className="relative flex-1 border-l border-line">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    aria-label={`Schedule at ${h}:00`}
                    onClick={() => openSlot(day, h)}
                    className="block w-full border-b border-line/70 hover:bg-zoom-blue-soft/40"
                    style={{ height: HOUR_PX }}
                  />
                ))}

                {dayMeetings.map((m) => {
                  const { start, end } = meetingSpan(m);
                  const minutes = start.getHours() * 60 + start.getMinutes();
                  const length = (end.getTime() - start.getTime()) / 60_000;
                  const { lane, lanes: total } = lanes.get(m.meeting_code) ?? { lane: 0, lanes: 1 };
                  return (
                    <button
                      key={m.meeting_code}
                      type="button"
                      onClick={() => setSelected(m)}
                      className={clsx(
                        "absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm",
                        m.status === "ended"
                          ? "border-ink-subtle bg-surface-hover text-ink-muted"
                          : m.status === "live"
                            ? "border-success bg-success/15 text-ink"
                            : "border-zoom-blue bg-zoom-blue-soft text-ink",
                      )}
                      style={{
                        top: (minutes / 60) * HOUR_PX + 1,
                        height: Math.max(18, (length / 60) * HOUR_PX - 2),
                        left: `calc(${(lane / total) * 100}% + 2px)`,
                        width: `calc(${100 / total}% - 4px)`,
                      }}
                    >
                      <span className="block truncate font-bold">{m.title}</span>
                      {length >= 40 && <span className="block truncate">{formatTime(start)} - {formatTime(end)}</span>}
                    </button>
                  );
                })}

                {isToday && now && (
                  <span
                    className="pointer-events-none absolute right-0 left-0 z-10 border-t-2 border-danger"
                    style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX }}
                  >
                    <span className="absolute -top-[5px] -left-[5px] size-2 rounded-full bg-danger" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <MeetingDetailsDialog
        meeting={selected}
        onClose={() => setSelected(null)}
        onEdit={(m) => {
          setSelected(null);
          setSchedule({ start: null, meeting: m });
        }}
      />
      <ScheduleMeetingDialog
        open={schedule !== null}
        meeting={schedule?.meeting}
        initialStart={schedule?.start}
        onClose={() => setSchedule(null)}
      />
    </div>
  );
}
