"use client";

import clsx from "clsx";
import { MicOff } from "lucide-react";
import { MediaVideo } from "./MediaVideo";

export interface TileInfo {
  id: number;
  name: string;
  isSelf: boolean;
  isHost: boolean;
  micMuted: boolean;
  videoOn: boolean;
  handRaised: boolean;
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
}

/** One person: camera video, or their name when the camera is off, plus the name/mic label. */
export function VideoTile({ tile, speaking, reaction, compact, style }: VideoTileProps) {
  const label = `${tile.name}${tile.isSelf ? " (You)" : ""}`;

  return (
    <div style={style} className="relative overflow-hidden rounded-lg bg-meeting-tile">
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

      <span className="absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-12px)] items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
        {tile.micMuted && <MicOff className="size-3.5 shrink-0 text-[#e02828]" strokeWidth={2.5} />}
        <span className="truncate">{label}</span>
      </span>

      {tile.connecting && !tile.isSelf && (
        <span className="absolute top-2 left-1/2 -translate-x-1/2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white/80">
          Connecting…
        </span>
      )}
    </div>
  );
}
