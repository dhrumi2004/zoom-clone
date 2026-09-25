"use client";

import clsx from "clsx";
import { Ellipsis, MicOff, Pin, Star } from "lucide-react";
import { DropdownMenu, MenuItem } from "@/components/ui/DropdownMenu";
import { MediaVideo } from "./MediaVideo";

export interface TileInfo {
  id: number;
  name: string;
  isSelf: boolean;
  isHost: boolean;
  micMuted: boolean;
  videoOn: boolean;
  handRaised: boolean;
  isCohost: boolean;
  stream: MediaStream | null;
  /** Remote peer still connecting (shows a small hint) */
  connecting?: boolean;
}

interface VideoTileProps {
  tile: TileInfo;
  speaking: boolean;
  reaction?: string;
  compact?: boolean;
  style?: React.CSSProperties;
  /** The "…" menu shown on hover (Pin, Spotlight, Mute, Rename, …) */
  menu?: MenuItem[];
  pinned?: boolean;
  spotlighted?: boolean;
}

/** One person: camera video, or their name when the camera is off, plus the name/mic label. */
export function VideoTile({ tile, speaking, reaction, compact, style, menu, pinned, spotlighted }: VideoTileProps) {
  const label = `${tile.name}${tile.isSelf ? " (You)" : ""}`;

  return (
    <div style={style} className="group/tile relative overflow-hidden rounded-lg bg-meeting-tile">
      {/* The name sits underneath the video, so it also shows while the video is still loading. */}
      <div className="absolute inset-0 flex items-center justify-center px-3">
        <span className={clsx("truncate text-center font-bold text-white", compact ? "text-sm" : "text-2xl sm:text-3xl")}>
          {tile.name}
        </span>
      </div>
      {tile.videoOn && tile.stream && <MediaVideo stream={tile.stream} mirror={tile.isSelf} className="relative" />}

      {/* Zoom's green "active speaker" border, drawn above the video */}
      {speaking && <span className="pointer-events-none absolute inset-0 rounded-lg ring-[3px] ring-[#23d959] ring-inset" />}

      {tile.handRaised && (
        <span className="absolute top-2 left-2 rounded-md bg-white px-1.5 py-0.5 text-base shadow" title="Hand raised">
          ✋
        </span>
      )}

      {reaction && (
        <span key={reaction} className="absolute top-2 right-2 animate-bounce text-4xl drop-shadow">
          {reaction}
        </span>
      )}

      {menu && menu.length > 0 && (
        <div className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover/tile:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <DropdownMenu
            items={menu}
            trigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                aria-label={`Options for ${tile.name}`}
                aria-expanded={open}
                className="flex size-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80"
              >
                <Ellipsis className="size-4" />
              </button>
            )}
          />
        </div>
      )}

      <span className="absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-12px)] items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
        {tile.micMuted && <MicOff className="size-3.5 shrink-0 text-[#e02828]" strokeWidth={2.5} />}
        {spotlighted && <Star className="size-3 shrink-0 fill-[#f5b400] text-[#f5b400]" aria-label="Spotlighted" />}
        {pinned && <Pin className="size-3 shrink-0" aria-label="Pinned" />}
        <span className="truncate">{label}</span>
        {tile.isCohost && <span className="shrink-0 text-white/60">· Co-host</span>}
      </span>

      {tile.connecting && !tile.isSelf && (
        <span className="absolute top-2 left-1/2 -translate-x-1/2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white/80">
          Connecting…
        </span>
      )}
    </div>
  );
}
