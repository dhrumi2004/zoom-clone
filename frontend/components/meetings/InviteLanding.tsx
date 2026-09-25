"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { ZoomLogo } from "@/components/layout/ZoomLogo";
import { Avatar } from "@/components/ui/Avatar";
import { api, ApiError } from "@/lib/api";
import { formatMeetingCode, formatTime, formatRelativeDay } from "@/lib/format";
import { JoinForm } from "./JoinForm";

/** Page behind an invite link (/j/1234567890?pwd=abc): shows the meeting and asks for a name. */
export function InviteLanding({ code, passcode }: { code: string; passcode?: string }) {
  const { data: meeting, error, isLoading } = useSWR(["meeting", code], () => api.getMeeting(code));

  return (
    <div className="flex min-h-full flex-col bg-surface-muted">
      <header className="flex h-14 items-center border-b border-line bg-surface px-6">
        <Link href="/">
          <ZoomLogo />
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:items-center">
        <div className="w-full max-w-[420px] rounded-xl border border-line bg-surface p-6 shadow-sm">
          {isLoading && <div className="h-40 animate-pulse rounded-lg bg-surface-hover" />}

          {error && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CircleAlert className="size-10 text-danger" strokeWidth={1.5} />
              <p className="font-bold">
                {error instanceof ApiError && error.code === "not_found" ? "Invalid meeting ID" : "Something went wrong"}
              </p>
              <p className="text-sm text-ink-muted">{error.message}</p>
              <Link href="/" className="text-sm font-bold text-zoom-blue hover:underline">
                Go to home
              </Link>
            </div>
          )}

          {meeting && (
            <>
              <div className="mb-6 flex items-center gap-3">
                <Avatar name={meeting.host.name} color={meeting.host.avatar_color} size="lg" />
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold">{meeting.title}</h1>
                  <p className="text-xs text-ink-muted">
                    Hosted by {meeting.host.name} · ID {formatMeetingCode(meeting.meeting_code)}
                  </p>
                  {meeting.status === "scheduled" && meeting.scheduled_start && (
                    <p className="text-xs text-ink-muted">
                      {formatRelativeDay(meeting.scheduled_start)}, {formatTime(meeting.scheduled_start)}
                    </p>
                  )}
                  {meeting.status === "live" && <p className="text-xs font-bold text-success">Meeting in progress</p>}
                </div>
              </div>
              {meeting.status === "ended" ? (
                <p className="rounded-lg bg-surface-muted p-4 text-center text-sm text-ink-muted">This meeting has ended.</p>
              ) : (
                <JoinForm presetCode={meeting.meeting_code} presetPasscode={passcode} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
