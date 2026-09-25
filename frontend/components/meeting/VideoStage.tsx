"use client";

import { useRef } from "react";
import { useGalleryLayout } from "@/hooks/useGalleryLayout";
import type { Reaction } from "@/lib/meeting/client";
import { MediaVideo } from "./MediaVideo";
import { TileInfo, VideoTile } from "./VideoTile";

export type ViewMode = "gallery" | "speaker";

interface VideoStageProps {
  tiles: TileInfo[];
  view: ViewMode;
  speakingIds: number[];
  reactions: Reaction[];
  /** Who is presenting and their screen stream, if anyone is sharing. */
  share: { name: string; stream: MediaStream | null; isSelf: boolean } | null;
  /** Main person in speaker view (last active speaker). */
  spotlightId: number | null;
}

/** Chooses between Zoom's three layouts: screen share, speaker view and gallery view. */
export function VideoStage({ tiles, view, speakingIds, reactions, share, spotlightId }: VideoStageProps) {
  const reactionFor = (id: number) => [...reactions].reverse().find((r) => r.participantId === id)?.emoji;
  const tileProps = (t: TileInfo) => ({ tile: t, speaking: speakingIds.includes(t.id), reaction: reactionFor(t.id) });

  if (share) {
    return (
      <div className="flex size-full flex-col gap-2 md:flex-row">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-black">
          {share.stream ? (
            <MediaVideo stream={share.stream} fit="contain" />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-white/60">Loading shared screen…</div>
          )}
          <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
            {share.isSelf ? "Your screen" : `${share.name}'s screen`}
          </span>
        </div>
        <Filmstrip tiles={tiles} tileProps={tileProps} />
      </div>
    );
  }

  if (view === "speaker" && tiles.length > 1) {
    const main = tiles.find((t) => t.id === spotlightId) ?? tiles.find((t) => !t.isSelf) ?? tiles[0];
    return (
      <div className="flex size-full flex-col gap-2">
        <div className="flex shrink-0 justify-center gap-2 overflow-x-auto">
          {tiles
            .filter((t) => t.id !== main.id)
            .map((t) => (
              <VideoTile key={t.id} {...tileProps(t)} compact style={{ width: 176, height: 99, flexShrink: 0 }} />
            ))}
        </div>
        <SingleTile {...tileProps(main)} />
      </div>
    );
  }

  return <Gallery tiles={tiles} tileProps={tileProps} />;
}

type TilePropsFn = (t: TileInfo) => { tile: TileInfo; speaking: boolean; reaction?: string };

function Gallery({ tiles, tileProps }: { tiles: TileInfo[]; tileProps: TilePropsFn }) {
  const ref = useRef<HTMLDivElement>(null);
  const { cols, tileWidth, tileHeight } = useGalleryLayout(ref, tiles.length);
  return (
    <div ref={ref} className="flex size-full items-center justify-center">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, ${tileWidth}px)` }}>
        {tiles.map((t) => (
          <VideoTile key={t.id} {...tileProps(t)} compact={tileWidth < 260} style={{ width: tileWidth, height: tileHeight }} />
        ))}
      </div>
    </div>
  );
}

/** One big 16:9 tile that fills the remaining space. */
function SingleTile(props: { tile: TileInfo; speaking: boolean; reaction?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { tileWidth, tileHeight } = useGalleryLayout(ref, 1);
  return (
    <div ref={ref} className="flex min-h-0 flex-1 items-center justify-center">
      <VideoTile {...props} style={{ width: tileWidth, height: tileHeight }} />
    </div>
  );
}

function Filmstrip({ tiles, tileProps }: { tiles: TileInfo[]; tileProps: TilePropsFn }) {
  return (
    <div className="flex shrink-0 gap-2 overflow-auto md:w-56 md:flex-col">
      {tiles.map((t) => (
        <VideoTile key={t.id} {...tileProps(t)} compact style={{ width: 208, height: 117, flexShrink: 0 }} />
      ))}
    </div>
  );
}
