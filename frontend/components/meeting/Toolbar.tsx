"use client";

import clsx from "clsx";
import {
  BarChart3,
  Captions,
  Check,
  ChevronUp,
  Circle,
  Ellipsis,
  EyeOff,
  Grid2x2,
  Link2,
  Maximize,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  SmilePlus,
  Square,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { ReactNode, useCallback, useRef, useState } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import type { LocalMedia } from "@/lib/meeting/localMedia";
import { useStore } from "@/lib/meeting/store";
import { REACTIONS } from "@/lib/meeting/types";

export type Panel = "participants" | "chat" | "polls" | null;

interface ToolbarProps {
  media: LocalMedia;
  sharing: boolean;
  handRaised: boolean;
  participantCount: number;
  unreadChat: number;
  panel: Panel;
  isHost: boolean;
  isModerator: boolean;
  recording: boolean;
  captionsOn: boolean;
  selfViewHidden: boolean;
  hasOpenPoll: boolean;
  speakerId: string;
  security: ReactNode;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleShare: () => void;
  onTogglePanel: (panel: Exclude<Panel, null>) => void;
  onReact: (emoji: string) => void;
  onToggleHand: () => void;
  onCopyInvite: () => void;
  onToggleRecording: () => void;
  onToggleCaptions: () => void;
  onOpenBreakouts: () => void;
  onToggleSelfView: () => void;
  onSpeakerChange: (id: string) => void;
  onLeave: () => void;
  onEndForAll: () => void;
}

/** Zoom's bottom meeting controls: audio/video on the left, tools in the middle, End/Leave on the right. */
export function Toolbar(props: ToolbarProps) {
  const m = useStore(props.media);
  const { sharing, panel } = props;

  return (
    <footer className="flex h-[68px] shrink-0 items-center justify-between gap-2 bg-meeting-bar px-2 sm:px-4">
      <div className="flex items-center">
        <ToolButton label={m.micOn ? "Mute" : "Unmute"} onClick={props.onToggleMic} icon={m.micOn ? <Mic /> : <MicOff className="text-[#e02828]" />} />
        <DeviceMenu kind="audio" media={props.media} speakerId={props.speakerId} onSpeakerChange={props.onSpeakerChange} />
        <ToolButton
          label={m.camOn ? "Stop Video" : "Start Video"}
          onClick={props.onToggleCam}
          disabled={m.camStarting}
          icon={m.camOn ? <Video /> : <VideoOff className="text-[#e02828]" />}
        />
        <DeviceMenu kind="video" media={props.media} speakerId={props.speakerId} onSpeakerChange={props.onSpeakerChange} />
      </div>

      {/* No overflow scrolling here: it would clip the popovers that open above these buttons */}
      <div className="flex items-center">
        {props.isModerator && <div className="hidden md:block">{props.security}</div>}
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
        {props.isModerator && (
          <div className="hidden lg:block">
            <ToolButton
              label={props.recording ? "Stop Recording" : "Record"}
              onClick={props.onToggleRecording}
              icon={props.recording ? <Square className="fill-[#e02828] text-[#e02828]" /> : <Circle />}
            />
          </div>
        )}
        <MoreButton {...props} />
      </div>

      <LeaveButton isHost={props.isHost} onLeave={props.onLeave} onEndForAll={props.onEndForAll} />
    </footer>
  );
}

function ToolButton({
  label,
  icon,
  onClick,
  active,
  disabled,
  badge,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
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
      <span className="relative flex items-center [&>svg]:size-[22px]">{icon}</span>
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

function MenuRow({ children, onClick, checked }: { children: ReactNode; onClick: () => void; checked?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10">
      <span className="flex w-4 justify-center">{checked && <Check className="size-4 text-[#4d8dff]" />}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

/** The ⌃ next to Mute / Stop Video: pick microphone, speaker, camera; background blur. */
function DeviceMenu({
  kind,
  media,
  speakerId,
  onSpeakerChange,
}: {
  kind: "audio" | "video";
  media: LocalMedia;
  speakerId: string;
  onSpeakerChange: (id: string) => void;
}) {
  const { open, setOpen, close, ref } = usePopover();
  const m = useStore(media);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const toggle = async () => {
    if (!open) setDevices(await navigator.mediaDevices.enumerateDevices().catch(() => []));
    setOpen((o) => !o);
  };
  const currentMic = m.audioTrack?.getSettings().deviceId;
  const currentCam = m.videoTrack && !m.blur ? m.videoTrack.getSettings().deviceId : undefined;
  const list = (k: MediaDeviceKind) => devices.filter((d) => d.kind === k && d.deviceId);
  const canPickSpeaker = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

  return (
    <div ref={ref} className="relative -ml-2 self-start pt-2">
      <button
        type="button"
        onClick={toggle}
        aria-label={kind === "audio" ? "Audio options" : "Video options"}
        aria-expanded={open}
        className="rounded p-0.5 text-white/70 hover:bg-white/10 hover:text-white"
      >
        <ChevronUp className="size-3.5" />
      </button>
      {open && (
        <div className={clsx(popoverClass, "left-0 w-72")}>
          {kind === "audio" ? (
            <>
              <p className="px-3 py-1 text-xs text-white/50">Select a microphone</p>
              {list("audioinput").map((d, i) => (
                <MenuRow key={d.deviceId} checked={d.deviceId === currentMic} onClick={() => (media.switchMic(d.deviceId), close())}>
                  {d.label || `Microphone ${i + 1}`}
                </MenuRow>
              ))}
              {canPickSpeaker && (
                <>
                  <p className="px-3 pt-2 pb-1 text-xs text-white/50">Select a speaker</p>
                  {list("audiooutput").map((d, i) => (
                    <MenuRow
                      key={d.deviceId}
                      checked={d.deviceId === speakerId || (!speakerId && d.deviceId === "default")}
                      onClick={() => (onSpeakerChange(d.deviceId), close())}
                    >
                      {d.label || `Speaker ${i + 1}`}
                    </MenuRow>
                  ))}
                </>
              )}
            </>
          ) : (
            <>
              <p className="px-3 py-1 text-xs text-white/50">Select a camera</p>
              {list("videoinput").map((d, i) => (
                <MenuRow key={d.deviceId} checked={d.deviceId === currentCam} onClick={() => (media.switchCamera(d.deviceId), close())}>
                  {d.label || `Camera ${i + 1}`}
                </MenuRow>
              ))}
              <div className="my-1 h-px bg-white/10" />
              <MenuRow checked={m.blur} onClick={() => media.setBlur(!m.blur)}>
                {m.blurLoading ? "Loading background blur…" : "Blur my background"}
              </MenuRow>
              {m.blurError && <p className="px-3 py-1 text-xs text-[#ffb4b4]">{m.blurError}</p>}
            </>
          )}
          <div className="my-1 h-px bg-white/10" />
          <a href="/settings?tab=video" target="_blank" rel="noopener" className="block rounded-lg px-3 py-2 pl-9 hover:bg-white/10">
            {kind === "audio" ? "Audio settings…" : "Video settings…"}
          </a>
        </div>
      )}
    </div>
  );
}

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

function MoreButton(props: ToolbarProps) {
  const { open, setOpen, close, ref } = usePopover();
  const run = (fn: () => void) => () => {
    fn();
    close();
  };
  const toggleFullscreen = () =>
    document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen().catch(() => {});

  return (
    <div ref={ref} className="relative">
      <ToolButton label="More" active={open} onClick={() => setOpen((o) => !o)} icon={<Ellipsis />} />
      {open && (
        <div className={clsx(popoverClass, "right-0 w-64")}>
          {props.isModerator && (
            <MoreRow icon={props.recording ? <Square className="fill-[#e02828] text-[#e02828]" /> : <Circle />} onClick={run(props.onToggleRecording)}>
              {props.recording ? "Stop recording" : "Record to this computer"}
            </MoreRow>
          )}
          <MoreRow icon={<Captions />} onClick={run(props.onToggleCaptions)}>
            {props.captionsOn ? "Hide captions" : "Show captions"}
          </MoreRow>
          <MoreRow icon={<BarChart3 />} onClick={run(() => props.onTogglePanel("polls"))}>
            Polls {props.hasOpenPoll && <span className="ml-1 rounded-full bg-success px-1.5 text-[10px] font-bold">Live</span>}
          </MoreRow>
          {props.isModerator && (
            <MoreRow icon={<Grid2x2 />} onClick={run(props.onOpenBreakouts)}>
              Breakout rooms
            </MoreRow>
          )}
          <div className="my-1 h-px bg-white/10" />
          <MoreRow icon={<EyeOff />} onClick={run(props.onToggleSelfView)}>
            {props.selfViewHidden ? "Show self view" : "Hide self view"}
          </MoreRow>
          <MoreRow icon={<Maximize />} onClick={run(toggleFullscreen)}>
            Enter / exit full screen
          </MoreRow>
          <MoreRow icon={<Link2 />} onClick={run(props.onCopyInvite)}>
            Copy invite link
          </MoreRow>
          {props.isModerator && <div className="border-t border-white/10 pt-1 md:hidden">{props.security}</div>}
        </div>
      )}
    </div>
  );
}

function MoreRow({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/10 [&>svg]:size-4">
      {icon}
      <span className="flex-1">{children}</span>
    </button>
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
            <button type="button" onClick={onEndForAll} className="h-9 rounded-lg bg-[#e02828] font-bold hover:bg-[#c81e1e]">
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
