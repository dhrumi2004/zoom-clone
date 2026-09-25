"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { useDisposable } from "@/hooks/useDisposable";
import { refreshMeetingLists } from "@/hooks/useMeetings";
import { api, ApiError } from "@/lib/api";
import type { JoinIntent } from "@/lib/joinIntent";
import { LocalMedia } from "@/lib/meeting/localMedia";
import type { MeetingPublic, Participant } from "@/lib/types";
import { EndScreen, ExitReason } from "./EndScreen";
import { MeetingRoom } from "./MeetingRoom";
import { PreJoinScreen } from "./PreJoinScreen";

type Stage =
  | { kind: "preview"; error: { code: string; message: string } | null }
  | { kind: "joining" }
  | { kind: "room"; self: Participant; meeting: MeetingPublic; passcode: string | null }
  | { kind: "exit"; reason: ExitReason; detail?: string | null };

/** The whole visit to /meeting/{code}: preview -> room -> end screen. Owns the camera/mic for all three. */
export function MeetingExperience({ code, intent }: { code: string; intent: JoinIntent }) {
  const router = useRouter();
  const media = useDisposable(
    () => new LocalMedia(),
    (m) => m.destroy(),
  );
  const { data: meeting } = useSWR(["meeting", code], () => api.getMeeting(code));
  const [stage, setStage] = useState<Stage>({ kind: "preview", error: null });

  useEffect(() => media.init(intent.audioOn, intent.videoOn), [media, intent.audioOn, intent.videoOn]);

  const join = async (name: string, typedPasscode?: string) => {
    setStage({ kind: "joining" });
    // Screen sharing must start straight from the click (browser rule), before the network calls.
    if (intent.shareOnJoin) await media.startScreenShare();

    const passcode = typedPasscode || intent.passcode || null;
    try {
      const res = await api.join(code, { display_name: name, passcode, as_host: intent.asHost });
      // Meeting settings can override your choices ("Mute participants upon entry", video off).
      if (res.participant.is_muted) await media.setMic(false);
      if (res.participant.is_video_off) await media.setCam(false);

      let shownPasscode = passcode;
      if (intent.asHost) shownPasscode = (await api.getDetails(code).catch(() => null))?.passcode ?? null;
      setStage({ kind: "room", self: res.participant, meeting: res.meeting, passcode: shownPasscode });
      void refreshMeetingLists();
    } catch (e) {
      const error = e instanceof ApiError ? { code: e.code, message: e.message } : { code: "unknown", message: "Couldn't join the meeting." };
      setStage({ kind: "preview", error });
    }
  };

  const exit = useCallback(
    (reason: ExitReason, detail?: string | null) => {
      media.destroy(); // turn the camera light off immediately
      void refreshMeetingLists();
      if (reason === "ended" && intent.asHost) return router.push("/"); // the host ended it: straight home, like Zoom
      setStage({ kind: "exit", reason, detail });
    },
    [media, intent.asHost, router],
  );

  if (stage.kind === "exit") return <EndScreen reason={stage.reason} detail={stage.detail} />;

  if (stage.kind === "room") {
    return <MeetingRoom meeting={stage.meeting} self={stage.self} media={media} passcode={stage.passcode} onExit={exit} />;
  }

  return (
    <PreJoinScreen
      media={media}
      meeting={meeting}
      defaultName={intent.displayName}
      asHost={intent.asHost}
      shareOnJoin={intent.shareOnJoin}
      joining={stage.kind === "joining"}
      error={stage.kind === "preview" ? stage.error : null}
      onJoin={join}
    />
  );
}
