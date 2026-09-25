"use client";

import { Copy } from "lucide-react";
import { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatDuration, formatLongDate, formatMeetingCode, formatTimeRange } from "@/lib/format";
import { buildInvitation, copyToClipboard } from "@/lib/invite";
import type { Meeting } from "@/lib/types";

/** Shown after saving a new scheduled meeting: details + invite link + Copy invitation. */
export function ScheduledMeetingDetails({ meeting, onDone }: { meeting: Meeting; onDone: () => void }) {
  const toast = useToast();

  const copy = async (text: string, what: string) => {
    const ok = await copyToClipboard(text);
    toast(ok ? `${what} copied to clipboard` : "Couldn't copy. Please try again.", ok ? "success" : "error");
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-bold">{meeting.title}</p>
        {meeting.description && <p className="mt-1 text-sm text-ink-muted">{meeting.description}</p>}
      </div>

      <dl className="divide-y divide-line rounded-lg border border-line text-sm">
        {meeting.scheduled_start && meeting.duration_min && (
          <Row label="Time">
            {formatLongDate(meeting.scheduled_start)}
            <br />
            {formatTimeRange(meeting.scheduled_start, meeting.duration_min)} ({formatDuration(meeting.duration_min)})
          </Row>
        )}
        <Row label="Meeting ID">{formatMeetingCode(meeting.meeting_code)}</Row>
        <Row label="Passcode">{meeting.passcode}</Row>
        <Row label="Invite link">
          <span className="flex items-center gap-2">
            <a href={meeting.invite_link} className="min-w-0 truncate text-zoom-blue hover:underline">
              {meeting.invite_link}
            </a>
            <button
              type="button"
              onClick={() => copy(meeting.invite_link, "Link")}
              aria-label="Copy link"
              className="shrink-0 rounded p-1 text-ink-muted hover:bg-surface-hover"
            >
              <Copy className="size-4" />
            </button>
          </span>
        </Row>
      </dl>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={() => copy(buildInvitation(meeting), "Invitation")}>
          <Copy className="size-4" /> Copy invitation
        </Button>
        <Button onClick={onDone} data-autofocus>
          Done
        </Button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-3">
      <dt className="w-24 shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
