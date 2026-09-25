"use client";

import clsx from "clsx";
import { History, Users, Video, Zap } from "lucide-react";
import { useRecentMeetings } from "@/hooks/useMeetings";
import { formatDuration, formatMeetingCode, formatRelativeDay, formatTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { ListState } from "./ListState";

/** Ended meetings, newest first. `limit` trims the list on the home screen. */
export function RecentMeetingsList({ limit }: { limit?: number }) {
  const { data, error, isLoading, mutate } = useRecentMeetings();

  if (isLoading || error || !data?.length) {
    return (
      <ListState
        loading={isLoading}
        error={error}
        onRetry={() => mutate()}
        emptyIcon={History}
        emptyTitle="No recent meetings"
      />
    );
  }

  return (
    <ul className="divide-y divide-line">
      {(limit ? data.slice(0, limit) : data).map((m) => (
        <RecentMeetingRow key={m.meeting_code} meeting={m} />
      ))}
    </ul>
  );
}

function actualMinutes(m: Meeting): number | null {
  if (!m.started_at || !m.ended_at) return null;
  return Math.max(1, Math.round((new Date(m.ended_at).getTime() - new Date(m.started_at).getTime()) / 60_000));
}

function RecentMeetingRow({ meeting }: { meeting: Meeting }) {
  const instant = meeting.type === "instant";
  const minutes = actualMinutes(meeting);
  const Icon = instant ? Zap : Video;

  return (
    <li className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted">
      <span
        className={clsx(
          "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
          instant ? "bg-zoom-orange/10 text-zoom-orange" : "bg-zoom-blue-soft text-zoom-blue",
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold" title={meeting.title}>
          {meeting.title}
        </p>
        <p className="truncate text-xs text-ink-muted">
          {meeting.started_at && `${formatRelativeDay(meeting.started_at)}, ${formatTime(meeting.started_at)}`}
          {minutes !== null && ` · ${formatDuration(minutes)}`}
        </p>
      </div>
      <div className="hidden shrink-0 text-right text-xs text-ink-subtle sm:block">
        <p className="flex items-center justify-end gap-1">
          <Users className="size-3.5" /> {meeting.participant_count}
        </p>
        <p>{formatMeetingCode(meeting.meeting_code)}</p>
      </div>
    </li>
  );
}
