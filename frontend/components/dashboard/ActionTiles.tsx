"use client";

import clsx from "clsx";
import { ArrowUp, ChevronDown, Plus, Video } from "lucide-react";
import { ReactNode, useCallback, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/Field";
import { useClickOutside } from "@/hooks/useClickOutside";
import { prefs } from "@/lib/storage";

interface ActionTilesProps {
  onNewMeeting?: () => void;
  onJoin?: () => void;
  onSchedule?: () => void;
  onShareScreen?: () => void;
  creating?: boolean;
}

/** The 2x2 grid of big square buttons on Zoom's home screen. */
export function ActionTiles({ onNewMeeting, onJoin, onSchedule, onShareScreen, creating }: ActionTilesProps) {
  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-6 sm:grid-cols-2 sm:gap-x-12 sm:gap-y-8">
      <Tile
        label="New meeting"
        labelExtra={<NewMeetingOptions />}
        color="orange"
        onClick={onNewMeeting}
        busy={creating}
        icon={<Video className="size-9" fill="currentColor" strokeWidth={1.5} />}
      />
      <Tile label="Join" color="blue" onClick={onJoin} icon={<Plus className="size-10" strokeWidth={2.75} />} />
      <Tile label="Schedule" color="blue" onClick={onSchedule} icon={<CalendarGlyph />} />
      <Tile
        label="Share screen"
        color="blue"
        onClick={onShareScreen}
        icon={<ArrowUp className="size-9" strokeWidth={2.75} />}
      />
    </div>
  );
}

function Tile({
  label,
  labelExtra,
  icon,
  color,
  onClick,
  busy,
}: {
  label: ReactNode;
  /** Rendered next to the label, outside the main button (e.g. the New meeting options chevron). */
  labelExtra?: ReactNode;
  icon: ReactNode;
  color: "orange" | "blue";
  onClick?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-label={typeof label === "string" ? label : undefined}
        className="group outline-none"
      >
        <span
        className={clsx(
          "flex size-16 items-center justify-center rounded-[22px] text-white shadow-sm transition-all sm:size-20 sm:rounded-3xl",
          "group-hover:brightness-95 group-active:scale-95 group-focus-visible:ring-4 group-focus-visible:ring-zoom-blue/30",
          color === "orange" ? "bg-zoom-orange" : "bg-zoom-blue",
        )}
      >
          {busy ? <span className="size-7 animate-spin rounded-full border-[3px] border-white border-t-transparent" /> : icon}
        </span>
      </button>
      <span className="flex items-center gap-0.5 text-center text-[11px] whitespace-nowrap text-ink sm:text-[13px]">
        <button type="button" onClick={onClick} disabled={busy} className="hover:underline">
          {label}
        </button>
        {labelExtra}
      </span>
    </div>
  );
}

/** The chevron next to "New meeting": Zoom's "Start with video" option, remembered across visits. */
function NewMeetingOptions() {
  const [open, setOpen] = useState(false);
  const [withVideo, setWithVideo] = useState(() => prefs.startWithVideo());
  const ref = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <span ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="New meeting options"
        aria-expanded={open}
        className="flex rounded p-0.5 hover:bg-surface-hover"
      >
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <span className="absolute top-full left-1/2 z-30 mt-2 block w-56 -translate-x-1/2 rounded-lg border border-line bg-surface p-3 text-left shadow-popover">
          <Checkbox
            checked={withVideo}
            onChange={(on) => {
              setWithVideo(on);
              prefs.setStartWithVideo(on);
            }}
            label="Start with video"
          />
        </span>
      )}
    </span>
  );
}

/** Zoom's schedule icon: a calendar page showing "19". */
function CalendarGlyph() {
  return (
    <span className="relative flex h-9 w-9 flex-col overflow-hidden rounded-md border-[2.5px] border-white">
      <span className="h-2 bg-white" />
      <span className="flex flex-1 items-center justify-center text-[15px] leading-none font-black">19</span>
    </span>
  );
}
