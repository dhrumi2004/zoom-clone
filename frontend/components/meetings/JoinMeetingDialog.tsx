"use client";

import { Modal } from "@/components/ui/Modal";
import { JoinForm } from "./JoinForm";

interface Props {
  open: boolean;
  onClose: () => void;
  mode?: "join" | "share";
}

/** The form unmounts when closed, so every open starts fresh. */
export function JoinMeetingDialog({ open, onClose, mode = "join" }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={mode === "share" ? "Share screen" : "Join meeting"} className="max-w-[420px]">
      <JoinForm mode={mode} onCancel={onClose} />
    </Modal>
  );
}
