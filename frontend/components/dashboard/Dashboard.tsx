"use client";

import Link from "next/link";
import { useState } from "react";
import { JoinMeetingDialog } from "@/components/meetings/JoinMeetingDialog";
import { ScheduleMeetingDialog } from "@/components/meetings/ScheduleMeetingDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useStartMeeting } from "@/hooks/useStartMeeting";
import type { Meeting } from "@/lib/types";
import { ActionTiles } from "./ActionTiles";
import { ClockHero } from "./ClockHero";
import { RecentMeetingsList } from "./RecentMeetingsList";
import { UpcomingMeetingsList } from "./UpcomingMeetingsList";

type Dialog = { kind: "join" } | { kind: "share" } | { kind: "schedule"; meeting?: Meeting } | null;

/** Zoom home: action tiles + recent meetings on the left, clock and upcoming meetings card on the right. */
export function Dashboard() {
  const { user } = useCurrentUser();
  const { startInstant, creating } = useStartMeeting(user);
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  const openSchedule = () => setDialog({ kind: "schedule" });
  const openEdit = (meeting: Meeting) => setDialog({ kind: "schedule", meeting });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-4 py-8 sm:px-6 lg:flex-row lg:items-start lg:justify-center lg:gap-16 lg:py-14">
      <div className="flex w-full max-w-md flex-col items-center gap-10 lg:w-auto lg:pt-10">
        <ActionTiles
          onNewMeeting={startInstant}
          creating={creating}
          onJoin={() => setDialog({ kind: "join" })}
          onSchedule={openSchedule}
          onShareScreen={() => setDialog({ kind: "share" })}
        />

        <section className="hidden w-full min-w-80 overflow-hidden rounded-xl border border-line lg:block">
          <SectionHeader title="Recent meetings" href="/meetings?tab=previous" />
          <RecentMeetingsList limit={3} />
        </section>
      </div>

      <section className="w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface lg:max-w-[500px]">
        <ClockHero />
        <SectionHeader title="Upcoming meetings" href="/meetings" />
        <div className="max-h-[420px] overflow-y-auto">
          <UpcomingMeetingsList onSchedule={openSchedule} onEdit={openEdit} />
        </div>
      </section>

      {/* On smaller screens, recent meetings go below the calendar card */}
      <section className="w-full max-w-md overflow-hidden rounded-xl border border-line lg:hidden">
        <SectionHeader title="Recent meetings" href="/meetings?tab=previous" />
        <RecentMeetingsList limit={3} />
      </section>

      <JoinMeetingDialog open={dialog?.kind === "join"} onClose={close} />
      <JoinMeetingDialog open={dialog?.kind === "share"} onClose={close} mode="share" />
      <ScheduleMeetingDialog
        open={dialog?.kind === "schedule"}
        meeting={dialog?.kind === "schedule" ? dialog.meeting : null}
        onClose={close}
      />
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-5 py-3">
      <h2 className="text-sm font-bold">{title}</h2>
      <Link href={href} className="text-xs font-bold text-zoom-blue hover:underline">
        View all
      </Link>
    </div>
  );
}
