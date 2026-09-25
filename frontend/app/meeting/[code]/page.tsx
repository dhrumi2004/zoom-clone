"use client";

import { use } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { MeetingExperience } from "@/components/meeting/MeetingExperience";
import { JoinForm } from "@/components/meetings/JoinForm";
import { useJoinIntent } from "@/hooks/useJoinIntent";
import { formatMeetingCode } from "@/lib/format";

/**
 * /meeting/{code}. Dashboard buttons, the Join dialog and invite links save a "join intent" first.
 * Opening the URL directly (no intent) asks for name/passcode with the normal Join form.
 * Signing in is required first (you come back here afterwards).
 */
export default function MeetingPage({ params }: PageProps<"/meeting/[code]">) {
  const { code } = use(params);
  return (
    <RequireAuth>
      <Meeting code={code} />
    </RequireAuth>
  );
}

function Meeting({ code }: { code: string }) {
  const intent = useJoinIntent(code);

  if (intent === undefined) return <div className="h-full bg-meeting-bg" />;
  if (intent) return <MeetingExperience code={code} intent={intent} />;

  return (
    <div className="flex min-h-full items-center justify-center bg-meeting-bg p-4">
      <div className="w-full max-w-[420px] rounded-xl bg-surface p-6">
        <p className="text-xs text-ink-muted">Meeting ID {formatMeetingCode(code)}</p>
        <h1 className="mt-1 mb-4 text-lg font-bold">Join meeting</h1>
        <JoinForm presetCode={code} />
      </div>
    </div>
  );
}
