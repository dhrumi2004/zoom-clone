"use client";

import { CalendarDays } from "lucide-react";
import { ListState } from "@/components/dashboard/ListState";
import { Button } from "@/components/ui/Button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUpcomingMeetings } from "@/hooks/useMeetings";
import { useStartMeeting } from "@/hooks/useStartMeeting";
import { formatMeetingCode, formatRelativeDay, formatTimeRange } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { MeetingActionsMenu } from "./MeetingActionsMenu";

interface Props {
  onEdit?: (meeting: Meeting) => void;
  onSchedule?: () => void;
}

/** Upcoming meetings grouped by day ("Today", "Tomorrow", "Mon, Sep 29"). Live meetings are shown first. */
export function UpcomingMeetingsList({ onEdit, onSchedule }: Props) {
  const { data, error, isLoading, mutate } = useUpcomingMeetings();

  if (isLoading || error || !data?.length) {
    return (
      <ListState
        loading={isLoading}
        error={error}
        onRetry={() => mutate()}
        emptyIcon={CalendarDays}
        emptyTitle="No upcoming meetings"
        emptyAction={
          onSchedule && (
            <button type="button" onClick={onSchedule} className="text-sm font-bold text-zoom-blue hover:underline">
              Schedule a meeting
            </button>
          )
        }
      />
    );
  }

  const groups = groupByDay(data);
  return (
    <div className="divide-y divide-line">
      {groups.map(([day, meetings]) => (
        <section key={day} className="py-2">
          <h3 className="px-5 pt-1 pb-1 text-xs font-bold text-ink-muted">{day}</h3>
          <ul>
            {meetings.map((m) => (
              <UpcomingMeetingRow key={m.meeting_code} meeting={m} onEdit={onEdit} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function groupByDay(meetings: Meeting[]): [string, Meeting[]][] {
  const groups = new Map<string, Meeting[]>();
  for (const m of meetings) {
    const day = m.status === "live" ? "In progress" : formatRelativeDay(m.scheduled_start!);
    groups.set(day, [...(groups.get(day) ?? []), m]);
  }
  return [...groups.entries()];
}

function UpcomingMeetingRow({ meeting, onEdit }: { meeting: Meeting; onEdit?: (m: Meeting) => void }) {
  const { user } = useCurrentUser();
  const { enterAsHost } = useStartMeeting(user);
  const live = meeting.status === "live";
  const when =
    meeting.scheduled_start && meeting.duration_min
      ? formatTimeRange(meeting.scheduled_start, meeting.duration_min)
      : "Started";

  return (
    <li className="group flex items-center gap-3 px-5 py-2.5 hover:bg-surface-muted">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-xs text-ink-muted">
          {live && (
            <span className="inline-flex items-center gap-1 font-bold text-success">
              <span className="size-1.5 animate-pulse rounded-full bg-success" /> Live
            </span>
          )}
          {when}
        </p>
        <p className="truncate text-sm font-bold" title={meeting.title}>
          {meeting.title}
        </p>
        <p className="text-xs text-ink-subtle">Meeting ID: {formatMeetingCode(meeting.meeting_code)}</p>
      </div>
      <MeetingActionsMenu meeting={meeting} onEdit={onEdit} />
      {/* These are the user's own meetings, so both Start and Join enter as host */}
      <Button size="sm" onClick={() => enterAsHost(meeting.meeting_code)}>
        {live ? "Join" : "Start"}
      </Button>
    </li>
  );
}
