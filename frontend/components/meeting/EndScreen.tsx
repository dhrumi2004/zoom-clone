"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export type ExitReason = "left" | "ended" | "removed" | "replaced" | "disconnected" | "failed";

const COPY: Record<ExitReason, { title: string; text: string; rejoin: boolean }> = {
  left: { title: "You left the meeting", text: "Thanks for joining.", rejoin: true },
  ended: { title: "This meeting has been ended by host", text: "The host ended the meeting for everyone.", rejoin: false },
  removed: { title: "You have been removed from this meeting by the host", text: "You can't rejoin this meeting.", rejoin: false },
  replaced: { title: "You joined from another window", text: "This meeting is open in another tab or window.", rejoin: true },
  disconnected: { title: "Connection lost", text: "Your connection to the meeting was interrupted.", rejoin: true },
  failed: { title: "Unable to join", text: "Something went wrong while joining this meeting.", rejoin: true },
};

/** Shown after leaving, being removed or when the host ends the meeting. */
export function EndScreen({ reason, detail }: { reason: ExitReason; detail?: string | null }) {
  const copy = COPY[reason];
  return (
    <div className="flex min-h-full items-center justify-center bg-meeting-bg p-4 text-white">
      <div className="w-full max-w-md rounded-xl bg-[#2a2a2a] p-8 text-center">
        <h1 className="text-xl font-bold">{copy.title}</h1>
        <p className="mt-2 text-sm text-white/70">{detail || copy.text}</p>
        <div className="mt-6 flex justify-center gap-2">
          {copy.rejoin && (
            <Button variant="secondary" onClick={() => window.location.reload()} className="border-white/20 bg-transparent text-white hover:bg-white/10">
              Rejoin
            </Button>
          )}
          <Link href="/" className="inline-flex h-9 items-center rounded-lg bg-zoom-blue px-4 text-sm font-bold hover:bg-zoom-blue-hover">
            Return to home
          </Link>
        </div>
      </div>
    </div>
  );
}
