"use client";

import { Copy, Pencil, Trash2, Video } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { refreshMeetingLists } from "@/hooks/useMeetings";
import { useStartMeeting } from "@/hooks/useStartMeeting";
import { api, ApiError } from "@/lib/api";
import { formatLongDate, formatMeetingCode, formatTime } from "@/lib/format";
import { buildInvitation, copyToClipboard } from "@/lib/invite";
import type { Meeting } from "@/lib/types";
import { meetingSpan } from "./calendarMath";

/** Click on a calendar event: details + Start / Copy invitation / Edit / Delete. */
export function MeetingDetailsDialog({
  meeting,
  onClose,
  onEdit,
}: {
  meeting: Meeting | null;
  onClose: () => void;
  onEdit: (m: Meeting) => void;
}) {
  const toast = useToast();
  const { user } = useCurrentUser();
  const { enterAsHost } = useStartMeeting(user);
  const [confirm, setConfirm] = useState(false);
  if (!meeting) return null;
  const { start, end } = meetingSpan(meeting);
  const ended = meeting.status === "ended";

  return (
    <>
      <Modal open onClose={onClose} title={meeting.title}>
        <dl className="space-y-2 text-sm">
          <Row label="When">
            {formatLongDate(start)}, {formatTime(start)} - {formatTime(end)}
          </Row>
          <Row label="Meeting ID">{formatMeetingCode(meeting.meeting_code)}</Row>
          <Row label="Passcode">{meeting.passcode}</Row>
          <Row label="Status">
            {meeting.status === "live" ? <span className="font-bold text-success">In progress</span> : ended ? "Ended" : "Scheduled"}
          </Row>
          {meeting.description && <Row label="Description">{meeting.description}</Row>}
        </dl>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {meeting.status === "scheduled" && (
            <>
              <Button variant="soft" size="sm" onClick={() => setConfirm(true)}>
                <Trash2 className="size-4" /> Delete
              </Button>
              <Button variant="soft" size="sm" onClick={() => onEdit(meeting)}>
                <Pencil className="size-4" /> Edit
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              const ok = await copyToClipboard(buildInvitation(meeting));
              toast(ok ? "Invitation copied to clipboard" : "Couldn't copy", ok ? "success" : "error");
            }}
          >
            <Copy className="size-4" /> Copy invitation
          </Button>
          {!ended && (
            <Button size="sm" onClick={() => enterAsHost(meeting.meeting_code)}>
              <Video className="size-4" /> {meeting.status === "live" ? "Join" : "Start"}
            </Button>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Delete meeting?"
        message={`"${meeting.title}" will be removed for everyone.`}
        confirmLabel="Delete"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          try {
            await api.remove(meeting.meeting_code);
            await refreshMeetingLists();
            toast("Meeting deleted");
            setConfirm(false);
            onClose();
          } catch (e) {
            toast(e instanceof ApiError ? e.message : "Couldn't delete", "error");
          }
        }}
      />
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}
