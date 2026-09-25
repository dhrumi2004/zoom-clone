"use client";

import { Button } from "@/components/ui/Button";
import { formatLongDate } from "@/lib/format";
import type { WaitingPerson } from "@/lib/meeting/types";

/** What a guest sees until the host admits them. */
export function WaitingRoomScreen({ title, onLeave }: { title: string; onLeave: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-meeting-bg p-6 text-center text-white">
      <span className="size-10 animate-spin rounded-full border-4 border-white/20 border-t-zoom-blue" />
      <h1 className="text-xl font-bold">Please wait, the meeting host will let you in soon.</h1>
      <p className="text-sm text-white/70">
        {title}
        <br />
        {formatLongDate(new Date())}
      </p>
      <Button variant="danger" onClick={onLeave} className="mt-4">
        Leave
      </Button>
    </div>
  );
}

/** Host pop-up at the top right when someone enters the waiting room. */
export function WaitingRoomAlert({
  waiting,
  onAdmit,
  onDeny,
  onSeeAll,
}: {
  waiting: WaitingPerson[];
  onAdmit: (id: number) => void;
  onDeny: (id: number) => void;
  onSeeAll: () => void;
}) {
  if (!waiting.length) return null;
  const single = waiting.length === 1 ? waiting[0] : null;

  return (
    <div role="alert" className="absolute top-3 right-3 z-30 w-72 rounded-xl bg-white p-4 text-ink shadow-popover">
      <p className="text-sm">
        {single ? (
          <>
            <b>{single.display_name}</b> has entered the waiting room.
          </>
        ) : (
          <>
            <b>{waiting.length} people</b> are waiting to join.
          </>
        )}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        {single ? (
          <>
            <Button size="sm" variant="soft" onClick={() => onDeny(single.id)}>
              Remove
            </Button>
            <Button size="sm" onClick={() => onAdmit(single.id)}>
              Admit
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onSeeAll}>
            See waiting room
          </Button>
        )}
      </div>
    </div>
  );
}
