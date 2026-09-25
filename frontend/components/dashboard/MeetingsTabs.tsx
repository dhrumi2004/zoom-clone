"use client";

import clsx from "clsx";
import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ScheduleMeetingDialog } from "@/components/meetings/ScheduleMeetingDialog";
import { Button } from "@/components/ui/Button";
import type { Meeting } from "@/lib/types";
import { RecentMeetingsList } from "./RecentMeetingsList";
import { UpcomingMeetingsList } from "./UpcomingMeetingsList";

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "previous", label: "Previous" },
] as const;

/** Meetings tab: Upcoming / Previous, with the active tab kept in the URL (?tab=previous). */
export function MeetingsTabs() {
  const router = useRouter();
  const tab = useSearchParams().get("tab") === "previous" ? "previous" : "upcoming";
  const [editing, setEditing] = useState<{ meeting: Meeting | null } | null>(null);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meetings</h1>
        <Button onClick={() => setEditing({ meeting: null })}>
          <Plus className="size-4" /> Schedule a meeting
        </Button>
      </div>
      <div role="tablist" className="mb-4 flex gap-6 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => router.replace(t.id === "upcoming" ? "/meetings" : `/meetings?tab=${t.id}`)}
            className={clsx(
              "-mb-px border-b-2 pb-2.5 text-sm font-bold transition-colors",
              tab === t.id ? "border-zoom-blue text-zoom-blue" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-line">
        {tab === "upcoming" ? (
          <UpcomingMeetingsList
            onEdit={(meeting) => setEditing({ meeting })}
            onSchedule={() => setEditing({ meeting: null })}
          />
        ) : (
          <RecentMeetingsList />
        )}
      </div>
      <ScheduleMeetingDialog open={editing !== null} meeting={editing?.meeting} onClose={() => setEditing(null)} />
    </div>
  );
}
