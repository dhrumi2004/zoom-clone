/** Date helpers for the calendar grid (all in the viewer's local time). */
import type { Meeting } from "@/lib/types";

export const HOUR_PX = 48;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** Sunday of the week containing `d` (Zoom's calendar starts weeks on Sunday). */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  return addDays(day, -day.getDay());
}

export function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/** When a meeting starts/ends on the calendar (instant meetings use when they actually ran). */
export function meetingSpan(m: Meeting): { start: Date; end: Date } {
  const start = new Date(m.scheduled_start ?? m.started_at ?? m.created_at);
  let end: Date;
  if (m.duration_min) end = new Date(start.getTime() + m.duration_min * 60_000);
  else if (m.ended_at) end = new Date(m.ended_at);
  else end = new Date(start.getTime() + 30 * 60_000);
  // Keep very short meetings clickable
  if (end.getTime() - start.getTime() < 20 * 60_000) end = new Date(start.getTime() + 20 * 60_000);
  return { start, end };
}

/** Side-by-side columns for overlapping meetings in one day: returns lane index and lane count per meeting. */
export function layoutLanes(meetings: Meeting[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...meetings].sort((a, b) => meetingSpan(a).start.getTime() - meetingSpan(b).start.getTime());
  const result = new Map<string, { lane: number; lanes: number }>();
  let cluster: { m: Meeting; lane: number }[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => result.set(c.m.meeting_code, { lane: c.lane, lanes }));
    cluster = [];
  };
  for (const m of sorted) {
    const { start, end } = meetingSpan(m);
    if (cluster.length && start.getTime() >= clusterEnd) flush();
    const busy = new Set(cluster.filter((c) => meetingSpan(c.m).end > start).map((c) => c.lane));
    let lane = 0;
    while (busy.has(lane)) lane++;
    cluster.push({ m, lane });
    clusterEnd = Math.max(clusterEnd, end.getTime());
  }
  flush();
  return result;
}
