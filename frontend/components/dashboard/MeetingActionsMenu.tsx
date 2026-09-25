"use client";

import { Copy, Ellipsis, Mail, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu, MenuItem } from "@/components/ui/DropdownMenu";
import { useToast } from "@/components/ui/Toast";
import { refreshMeetingLists } from "@/hooks/useMeetings";
import { api, ApiError } from "@/lib/api";
import { buildInvitation, copyToClipboard, emailInvitationUrl } from "@/lib/invite";
import type { Meeting } from "@/lib/types";

/** "..." menu on an upcoming meeting: copy invitation, edit, delete. */
export function MeetingActionsMenu({ meeting, onEdit }: { meeting: Meeting; onEdit?: (m: Meeting) => void }) {
  const toast = useToast();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const copyInvitation = async () => {
    const ok = await copyToClipboard(buildInvitation(meeting));
    toast(ok ? "Invitation copied to clipboard" : "Couldn't copy. Please try again.", ok ? "success" : "error");
  };

  const deleteMeeting = async () => {
    setDeleting(true);
    try {
      await api.remove(meeting.meeting_code);
      await refreshMeetingLists();
      toast("Meeting deleted");
      setConfirmOpen(false);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't delete the meeting.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const items: MenuItem[] = [
    { label: "Copy invitation", icon: Copy, onSelect: copyInvitation },
    { label: "Email invitation", icon: Mail, onSelect: () => router.push(emailInvitationUrl(meeting)) },
  ];
  if (meeting.status === "scheduled") {
    if (onEdit) items.push({ label: "Edit", icon: Pencil, onSelect: () => onEdit(meeting) });
    items.push({ label: "Delete", icon: Trash2, onSelect: () => setConfirmOpen(true), danger: true });
  }

  return (
    <>
      <DropdownMenu
        items={items}
        trigger={({ toggle, open }) => (
          <button
            type="button"
            onClick={toggle}
            aria-label="More options"
            aria-expanded={open}
            className="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            <Ellipsis className="size-5" />
          </button>
        )}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Delete meeting?"
        message={`"${meeting.title}" will be removed for everyone. This can't be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={deleteMeeting}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
