"use client";

import clsx from "clsx";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import Link from "next/link";
import { FormEvent, ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LocalMedia } from "@/lib/meeting/localMedia";
import { useStore } from "@/lib/meeting/store";
import type { MeetingPublic } from "@/lib/types";
import { MediaVideo } from "./MediaVideo";

interface Props {
  media: LocalMedia;
  meeting: MeetingPublic | undefined;
  defaultName: string;
  asHost: boolean;
  shareOnJoin?: boolean;
  joining: boolean;
  error: { code: string; message: string } | null;
  onJoin: (name: string, passcode?: string) => void;
}

/** Zoom's video preview before entering: camera preview, mic/camera toggles, name, Join. */
export function PreJoinScreen({ media, meeting, defaultName, asHost, shareOnJoin, joining, error, onJoin }: Props) {
  const m = useStore(media);
  const [name, setName] = useState(defaultName);
  const [passcode, setPasscode] = useState("");
  const needsPasscode = error?.code === "passcode_required" || error?.code === "wrong_passcode";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onJoin(name.trim(), needsPasscode ? passcode.trim() : undefined);
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 bg-meeting-bg px-4 py-8 text-white">
      <div className="text-center">
        <h1 className="text-xl font-bold">{meeting?.title ?? " "}</h1>
        {meeting && <p className="mt-0.5 text-xs text-white/60">Hosted by {meeting.host.name}</p>}
      </div>

      <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-xl bg-meeting-tile">
        {m.camOn && m.cameraStream ? (
          <MediaVideo stream={m.cameraStream} mirror />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="text-2xl font-bold">{name || " "}</span>
            <span className="text-sm text-white/60">{m.camStarting ? "Starting camera…" : "Your camera is off"}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-3">
          <RoundToggle
            on={m.micOn}
            onClick={() => media.setMic(!m.micOn)}
            label={m.micOn ? "Mute" : "Unmute"}
            icon={m.micOn ? <Mic /> : <MicOff />}
          />
          <RoundToggle
            on={m.camOn}
            disabled={m.camStarting}
            onClick={() => media.setCam(!m.camOn)}
            label={m.camOn ? "Stop Video" : "Start Video"}
            icon={m.camOn ? <Video /> : <VideoOff />}
          />
        </div>
      </div>

      {(m.camError || m.micError) && (
        <div className="w-full max-w-2xl space-y-1 rounded-lg bg-[#3a2a1a] px-4 py-2 text-xs text-[#ffc38a]">
          {m.camError && <p>{m.camError}</p>}
          {m.micError && <p>{m.micError}</p>}
        </div>
      )}

      <form onSubmit={submit} className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-xs text-white/70">Your name</span>
          <input
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm outline-none focus:border-zoom-blue"
          />
        </label>
        {needsPasscode && (
          <label className="sm:w-48">
            <span className="mb-1 block text-xs text-white/70">Meeting passcode</span>
            <input
              type="password"
              autoFocus
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm outline-none focus:border-zoom-blue"
            />
          </label>
        )}
        <Button type="submit" size="lg" loading={joining} disabled={!name.trim()} className="sm:min-w-28">
          {shareOnJoin ? "Join & Share" : asHost ? "Start" : "Join"}
        </Button>
      </form>

      {error && <p className="max-w-2xl text-center text-sm text-[#ff8080]">{error.message}</p>}

      <Link href="/" className="text-xs text-white/60 hover:text-white hover:underline">
        Cancel
      </Link>
    </div>
  );
}

function RoundToggle({
  on,
  onClick,
  label,
  icon,
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={clsx(
        "flex size-12 items-center justify-center rounded-full transition-colors disabled:opacity-50 [&>svg]:size-5",
        on ? "bg-white/15 hover:bg-white/25" : "bg-[#e02828] hover:bg-[#c81e1e]",
      )}
    >
      {icon}
    </button>
  );
}
