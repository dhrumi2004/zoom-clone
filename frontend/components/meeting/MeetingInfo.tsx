"use client";

import { Copy, ShieldCheck } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { formatMeetingCode } from "@/lib/format";
import type { MeetingPublic } from "@/lib/types";

interface Props {
  meeting: MeetingPublic;
  passcode: string | null;
  inviteLink: string;
  onCopy: (text: string, what: string) => void;
}

/** The green shield at the top-left of a Zoom meeting: title, ID, host, passcode, invite link. */
export function MeetingInfo({ meeting, passcode, inviteLink, onCopy }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Meeting information"
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/80 hover:bg-white/10"
      >
        <ShieldCheck className="size-4 text-[#23d959]" />
        <span className="hidden sm:inline">Meeting info</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-40 mt-2 w-80 rounded-xl bg-white p-4 text-sm text-ink shadow-popover">
          <p className="mb-3 truncate text-base font-bold">{meeting.title}</p>
          <dl className="space-y-2">
            <Row label="Meeting ID">{formatMeetingCode(meeting.meeting_code)}</Row>
            <Row label="Host">{meeting.host.name}</Row>
            {passcode && <Row label="Passcode">{passcode}</Row>}
            <Row label="Invite link">
              <span className="flex items-center gap-1">
                <span className="truncate text-zoom-blue">{inviteLink}</span>
                <button
                  type="button"
                  onClick={() => onCopy(inviteLink, "Invite link")}
                  aria-label="Copy invite link"
                  className="shrink-0 rounded p-1 text-ink-muted hover:bg-surface-hover"
                >
                  <Copy className="size-3.5" />
                </button>
              </span>
            </Row>
            <Row label="Encryption">
              <span className="flex items-center gap-1 text-success">
                <ShieldCheck className="size-3.5" /> Enabled
              </span>
            </Row>
          </dl>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
