"use client";

import clsx from "clsx";
import { Ellipsis, Mic, MicOff, Search, UserMinus, Video, VideoOff } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { colorForName } from "@/lib/format";
import type { WaitingPerson } from "@/lib/meeting/types";
import type { TileInfo } from "./VideoTile";

interface Props {
  people: TileInfo[];
  isHost: boolean;
  waiting: WaitingPerson[];
  onAdmit: (id: number) => void;
  onAdmitAll: () => void;
  onDeny: (id: number) => void;
  onInvite: () => void;
  onMuteAll: () => void;
  onMute: (id: number) => void;
  onAskUnmute: (id: number) => void;
  onRemove: (id: number) => void;
}

/** Zoom's Participants panel: everyone with mic/video state; hosts get Mute / Ask to Unmute / Remove. */
export function ParticipantsPanel(props: Props) {
  const { people, isHost, waiting, onInvite, onMuteAll, onMute, onAskUnmute, onRemove } = props;
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<{ kind: "muteAll" } | { kind: "remove"; person: TileInfo } | null>(null);

  // Zoom's order: you first, then raised hands, then everyone else as they joined.
  const sorted = [...people].sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || Number(b.handRaised) - Number(a.handRaised));
  const shown = sorted.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

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
        {isHost && waiting.length > 0 && (
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
        {shown.map((p) => (
          <li key={p.id} className="group flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface-muted">
            <Avatar name={p.name} color={colorForName(p.name)} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm">
              {p.name}
              <span className="text-ink-muted">
                {p.isHost && p.isSelf ? " (Host, me)" : p.isHost ? " (Host)" : p.isSelf ? " (me)" : ""}
              </span>
            </span>

            {/* Host actions appear on hover, like Zoom */}
            {isHost && !p.isSelf && (
              <span className="hidden items-center gap-1 group-focus-within:flex group-hover:flex [@media(hover:none)]:flex">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-xs"
                  onClick={() => (p.micMuted ? onAskUnmute(p.id) : onMute(p.id))}
                >
                  {p.micMuted ? "Ask to Unmute" : "Mute"}
                </Button>
                {!p.isHost && (
                  <DropdownMenu
                    items={[{ label: "Remove", icon: UserMinus, danger: true, onSelect: () => setConfirm({ kind: "remove", person: p }) }]}
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
            )}

            <span className={clsx("flex items-center gap-2", isHost && !p.isSelf && "group-focus-within:hidden group-hover:hidden [@media(hover:none)]:hidden")}>
              {p.handRaised && <span title="Hand raised">✋</span>}
              {p.micMuted ? (
                <MicOff className="size-4 text-danger" aria-label="Muted" />
              ) : (
                <Mic className="size-4 text-ink-muted" aria-label="Unmuted" />
              )}
              {p.videoOn ? (
                <Video className="size-4 text-ink-muted" aria-label="Video on" />
              ) : (
                <VideoOff className="size-4 text-danger" aria-label="Video off" />
              )}
            </span>
          </li>
        ))}
        {!shown.length && <li className="px-3 py-6 text-center text-sm text-ink-muted">No participants found</li>}
      </ul>

      <div className="flex gap-2 border-t border-line p-3">
        <Button variant="secondary" size="sm" className="flex-1" onClick={onInvite}>
          Invite
        </Button>
        {isHost && (
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => setConfirm({ kind: "muteAll" })}>
            Mute All
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirm?.kind === "muteAll"}
        title="Mute all participants?"
        message="All current participants will be muted. They can unmute themselves."
        confirmLabel="Mute All"
        onConfirm={() => {
          onMuteAll();
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "remove"}
        title={`Remove ${confirm?.kind === "remove" ? confirm.person.name : ""}?`}
        message="They will be removed from the meeting and won't be able to rejoin."
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirm?.kind === "remove") onRemove(confirm.person.id);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
