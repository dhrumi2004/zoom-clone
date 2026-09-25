"use client";

import clsx from "clsx";
import {
  ChevronUp,
  Ellipsis,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  SmilePlus,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { ReactNode, useCallback, useRef, useState } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { REACTIONS } from "@/lib/meeting/types";

export type Panel = "participants" | "chat" | null;

interface ToolbarProps {
  micOn: boolean;
  camOn: boolean;
  camBusy: boolean;
  sharing: boolean;
  handRaised: boolean;
  participantCount: number;
  unreadChat: number;
  panel: Panel;
  isHost: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleShare: () => void;
  onTogglePanel: (panel: Exclude<Panel, null>) => void;
  onReact: (emoji: string) => void;
  onToggleHand: () => void;
  onCopyInvite: () => void;
  onLeave: () => void;
  onEndForAll: () => void;
}

/** Zoom's bottom meeting controls: audio/video on the left, tools in the middle, End/Leave on the right. */
export function Toolbar(props: ToolbarProps) {
  const { micOn, camOn, sharing, panel } = props;

  return (
    <footer className="flex h-[68px] shrink-0 items-center justify-between gap-2 bg-meeting-bar px-2 sm:px-4">
      <div className="flex items-center">
        <ToolButton
          label={micOn ? "Mute" : "Unmute"}
          onClick={props.onToggleMic}
          icon={micOn ? <Mic /> : <MicOff className="text-[#e02828]" />}
          caret
        />
        <ToolButton
          label={camOn ? "Stop Video" : "Start Video"}
          onClick={props.onToggleCam}
          disabled={props.camBusy}
          icon={camOn ? <Video /> : <VideoOff className="text-[#e02828]" />}
          caret
        />
      </div>

      {/* No overflow scrolling here: it would clip the popovers that open above these buttons */}
      <div className="flex items-center">
        <ToolButton
          label="Participants"
          active={panel === "participants"}
          onClick={() => props.onTogglePanel("participants")}
          icon={<Users />}
          badge={<span className="absolute -top-1 left-[calc(50%+8px)] text-[11px] font-bold">{props.participantCount}</span>}
        />
        <ToolButton
          label="Chat"
          active={panel === "chat"}
          onClick={() => props.onTogglePanel("chat")}
          icon={<MessageSquare />}
          badge={
            props.unreadChat > 0 && (
              <span className="absolute -top-1 left-[calc(50%+6px)] min-w-4 rounded-full bg-[#e02828] px-1 text-[10px] leading-4 font-bold">
                {props.unreadChat > 99 ? "99+" : props.unreadChat}
              </span>
            )
          }
        />
        <ReactionsButton onReact={props.onReact} handRaised={props.handRaised} onToggleHand={props.onToggleHand} />
        <ToolButton
          label={sharing ? "Stop Share" : "Share"}
          onClick={props.onToggleShare}
          icon={<MonitorUp className={sharing ? "text-[#e02828]" : "text-[#23d959]"} />}
        />
        <MoreButton onCopyInvite={props.onCopyInvite} />
      </div>

      <LeaveButton isHost={props.isHost} onLeave={props.onLeave} onEndForAll={props.onEndForAll} />
    </footer>
  );
}

function ToolButton({
  label,
  icon,
  onClick,
  caret,
  active,
  disabled,
  badge,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  caret?: boolean;
  active?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      className={clsx(
        "relative flex h-[56px] min-w-11 shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] text-white/90 transition-colors hover:bg-white/10 disabled:opacity-50 sm:min-w-[72px] sm:px-2 sm:text-xs",
        active && "bg-white/10",
      )}
    >
      <span className="relative flex items-center [&>svg]:size-[22px]">
        {icon}
        {caret && <ChevronUp className="absolute -right-3.5 -bottom-0.5 !size-3 text-white/60" />}
      </span>
      {badge}
      {/* Phones show icons only, like Zoom's mobile layout */}
      <span className="hidden whitespace-nowrap sm:inline">{label}</span>
    </button>
  );
}

/** Dark popover that opens above a toolbar button. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  return { open, setOpen, close, ref };
}

const popoverClass =
  "absolute bottom-[calc(100%+8px)] z-40 rounded-xl border border-white/10 bg-[#2a2a2a] p-2 text-sm text-white shadow-popover";

function ReactionsButton({
  onReact,
  handRaised,
  onToggleHand,
}: {
  onReact: (emoji: string) => void;
  handRaised: boolean;
  onToggleHand: () => void;
}) {
  const { open, setOpen, close, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <ToolButton label="React" active={open} onClick={() => setOpen((o) => !o)} icon={<SmilePlus />} />
      {open && (
        <div className={clsx(popoverClass, "left-1/2 w-72 -translate-x-1/2")}>
          <div className="flex justify-between px-1">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onReact(emoji);
                  close();
                }}
                className="rounded-lg p-1.5 text-2xl transition-transform hover:scale-125 hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onToggleHand();
              close();
            }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2 hover:bg-white/15"
          >
            ✋ {handRaised ? "Lower Hand" : "Raise Hand"}
          </button>
        </div>
      )}
    </div>
  );
}

function MoreButton({ onCopyInvite }: { onCopyInvite: () => void }) {
  const { open, setOpen, close, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <ToolButton label="More" active={open} onClick={() => setOpen((o) => !o)} icon={<Ellipsis />} />
      {open && (
        <div className={clsx(popoverClass, "right-0 w-48")}>
          <button
            type="button"
            onClick={() => {
              onCopyInvite();
              close();
            }}
            className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/10"
          >
            Copy invite link
          </button>
        </div>
      )}
    </div>
  );
}

function LeaveButton({ isHost, onLeave, onEndForAll }: { isHost: boolean; onLeave: () => void; onEndForAll: () => void }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-8 rounded-lg bg-[#e02828] px-4 text-sm font-bold text-white hover:bg-[#c81e1e]"
      >
        {isHost ? "End" : "Leave"}
      </button>
      {open && (
        <div className={clsx(popoverClass, "right-0 flex w-64 flex-col gap-2 p-3")}>
          {isHost && (
            <button
              type="button"
              onClick={onEndForAll}
              className="h-9 rounded-lg bg-[#e02828] font-bold hover:bg-[#c81e1e]"
            >
              End meeting for all
            </button>
          )}
          <button
            type="button"
            onClick={onLeave}
            className={clsx("h-9 rounded-lg font-bold", isHost ? "bg-white/10 hover:bg-white/15" : "bg-[#e02828] hover:bg-[#c81e1e]")}
          >
            Leave meeting
          </button>
        </div>
      )}
    </div>
  );
}
