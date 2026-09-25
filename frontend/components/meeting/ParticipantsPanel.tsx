"use client";

import clsx from "clsx";
import { Ellipsis, Mic, MicOff, Search, Video, VideoOff } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu, MenuItem } from "@/components/ui/DropdownMenu";
import { colorForName } from "@/lib/format";
import type { WaitingPerson } from "@/lib/meeting/types";
import type { TileInfo } from "./VideoTile";

interface Props {
  people: TileInfo[];
  isModerator: boolean;
  waiting: WaitingPerson[];
  menuFor: (p: TileInfo) => MenuItem[];
  onAdmit: (id: number) => void;
  onAdmitAll: () => void;
  onDeny: (id: number) => void;
  onInvite: () => void;
  onMuteAll: () => void;
  onLowerAllHands: () => void;
  onMute: (id: number) => void;
  onAskUnmute: (id: number) => void;
}

/** Zoom's Participants panel: everyone with mic/video state; hosts get quick Mute plus the full "…" menu. */
export function ParticipantsPanel(props: Props) {
  const { people, isModerator, waiting } = props;
  const [query, setQuery] = useState("");
  const [confirmMuteAll, setConfirmMuteAll] = useState(false);

  // Zoom's order: you first, then raised hands, then everyone else as they joined.
  const sorted = [...people].sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || Number(b.handRaised) - Number(a.handRaised));
  const shown = sorted.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const anyHands = people.some((p) => p.handRaised);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <label className="mx-3 mt-3 flex h-8 items-center gap-2 rounded-lg border border-line px-2.5 text-sm focus-within:border-zoom-blue">
        <Search className="size-4 text-ink-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a participant"
          className="w-full bg-transparent outline-none placeholder:text-ink-subtle focus-visible:outline-none"
        />
      </label>

      <ul className="mt-2 min-h-0 flex-1 overflow-y-auto">
        {isModerator && waiting.length > 0 && (
          <li className="mb-2 border-b border-line pb-2">
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-xs font-bold text-ink-muted">Waiting Room ({waiting.length})</span>
              {waiting.length > 1 && (
                <button type="button" onClick={props.onAdmitAll} className="text-xs font-bold text-zoom-blue hover:underline">
                  Admit all
                </button>
              )}
            </div>
            {waiting.map((w) => (
              <div key={w.id} className="flex items-center gap-2.5 px-3 py-1.5">
                <Avatar name={w.display_name} color={colorForName(w.display_name)} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">{w.display_name}</span>
                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => props.onDeny(w.id)}>
                  Remove
                </Button>
                <Button size="sm" className="h-7 px-2 text-xs" onClick={() => props.onAdmit(w.id)}>
                  Admit
                </Button>
              </div>
            ))}
          </li>
        )}
        {shown.map((p) => {
          const menu = props.menuFor(p);
          const canManage = isModerator && !p.isSelf;
          return (
            <li key={p.id} className="group flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface-muted">
              <Avatar name={p.name} color={colorForName(p.name)} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm">
                {p.name}
                <span className="text-ink-muted">
                  {[p.isHost && "Host", p.isCohost && "Co-host", p.isSelf && "me"].filter(Boolean).length > 0 &&
                    ` (${[p.isHost && "Host", p.isCohost && "Co-host", p.isSelf && "me"].filter(Boolean).join(", ")})`}
                </span>
              </span>

              {/* Quick action + menu appear on hover, like Zoom */}
              <span className="hidden items-center gap-1 group-focus-within:flex group-hover:flex [@media(hover:none)]:flex">
                {canManage && !p.isHost && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-xs"
                    onClick={() => (p.micMuted ? props.onAskUnmute(p.id) : props.onMute(p.id))}
                  >
                    {p.micMuted ? "Ask to Unmute" : "Mute"}
                  </Button>
                )}
                {menu.length > 0 && (
                  <DropdownMenu
                    items={menu}
                    trigger={({ toggle }) => (
                      <button
                        type="button"
                        onClick={toggle}
                        aria-label={`More options for ${p.name}`}
                        className="flex h-7 items-center rounded-lg border border-line px-1.5 hover:bg-surface-hover"
                      >
                        <Ellipsis className="size-4" />
                      </button>
                    )}
                  />
                )}
              </span>

              <span className="flex items-center gap-2 group-focus-within:hidden group-hover:hidden [@media(hover:none)]:hidden">
                {p.handRaised && <span title="Hand raised">✋</span>}
                {p.micMuted ? <MicOff className="size-4 text-danger" aria-label="Muted" /> : <Mic className="size-4 text-ink-muted" aria-label="Unmuted" />}
                {p.videoOn ? (
                  <Video className="size-4 text-ink-muted" aria-label="Video on" />
                ) : (
                  <VideoOff className="size-4 text-danger" aria-label="Video off" />
                )}
              </span>
            </li>
          );
        })}
        {!shown.length && <li className="px-3 py-6 text-center text-sm text-ink-muted">No participants found</li>}
      </ul>

      <div className={clsx("flex flex-wrap gap-2 border-t border-line p-3")}>
        <Button variant="secondary" size="sm" className="flex-1" onClick={props.onInvite}>
          Invite
        </Button>
        {isModerator && (
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => setConfirmMuteAll(true)}>
            Mute All
          </Button>
        )}
        {isModerator && anyHands && (
          <Button variant="secondary" size="sm" className="w-full" onClick={props.onLowerAllHands}>
            Lower all hands
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmMuteAll}
        title="Mute all participants?"
        message="All current participants will be muted. They can unmute themselves unless you turn that off in Security."
        confirmLabel="Mute All"
        onConfirm={() => {
          props.onMuteAll();
          setConfirmMuteAll(false);
        }}
        onCancel={() => setConfirmMuteAll(false)}
      />
    </div>
  );
}
