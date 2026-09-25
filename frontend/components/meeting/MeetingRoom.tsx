"use client";

import { LayoutGrid, UserSquare2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDisposable } from "@/hooks/useDisposable";
import { copyToClipboard } from "@/lib/invite";
import { MeetingClient } from "@/lib/meeting/client";
import { LocalMedia } from "@/lib/meeting/localMedia";
import { SpeakingDetector } from "@/lib/meeting/speaking";
import { useStore } from "@/lib/meeting/store";
import type { MeetingPublic, Participant } from "@/lib/types";
import type { ExitReason } from "./EndScreen";
import { ChatPanel } from "./ChatPanel";
import { MeetingInfo } from "./MeetingInfo";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { WaitingRoomAlert, WaitingRoomScreen } from "./WaitingRoom";
import { RemoteAudio } from "./RemoteAudio";
import { Panel, Toolbar } from "./Toolbar";
import { ViewMode, VideoStage } from "./VideoStage";
import type { TileInfo } from "./VideoTile";

interface Props {
  meeting: MeetingPublic;
  self: Participant;
  media: LocalMedia;
  passcode: string | null;
  onExit: (reason: ExitReason, detail?: string | null) => void;
}

export function MeetingRoom({ meeting, self, media, passcode, onExit }: Props) {
  const client = useDisposable(
    () => new MeetingClient(meeting.meeting_code, self.id, media),
    (c) => c.leave(),
  );
  const detector = useDisposable(
    () => new SpeakingDetector(),
    (d) => d.destroy(),
  );
  const state = useStore(client);
  const m = useStore(media);
  const { speakingIds, recentSpeakers } = useStore(detector);

  const [view, setView] = useState<ViewMode>("gallery");
  const [panel, setPanel] = useState<Panel>(null);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const isHost = self.role === "host";
  const inviteLink = `${window.location.origin}/j/${meeting.meeting_code}${passcode ? `?pwd=${passcode}` : ""}`;

  useEffect(() => client.connect(), [client]);

  // Leave the room UI when the server says we're done (ended, removed, lost connection...).
  useEffect(() => {
    if (state.status !== "connecting" && state.status !== "waiting" && state.status !== "connected") {
      onExit(state.status, state.error);
    }
  }, [state.status, state.error, onExit]);

  // Feed every participant's microphone to the speaking detector.
  useEffect(() => {
    const tracks = new Map<number, MediaStreamTrack | null>();
    tracks.set(self.id, m.micOn ? m.audioTrack : null);
    for (const [id, r] of Object.entries(state.remote)) tracks.set(Number(id), r.camera.getAudioTracks()[0] ?? null);
    detector.setTracks(tracks);
  }, [detector, state.remote, m.audioTrack, m.micOn, self.id]);

  // Speaker view shows the last person who spoke (other than you).
  const spotlightId = recentSpeakers.find((id) => id !== self.id) ?? null;

  const tiles: TileInfo[] = useMemo(() => {
    const list = state.participants.length ? state.participants : [{ ...self, hand_raised: false, is_sharing: false }];
    const mine = list.filter((p) => p.id === self.id);
    const rest = list.filter((p) => p.id !== self.id);
    return [...mine, ...rest].map((p) => {
      const isSelf = p.id === self.id;
      const remote = state.remote[p.id];
      return {
        id: p.id,
        name: p.display_name,
        isSelf,
        isHost: p.role === "host",
        micMuted: isSelf ? !m.micOn : p.is_muted,
        videoOn: isSelf ? m.camOn : !p.is_video_off,
        handRaised: p.hand_raised,
        stream: isSelf ? m.cameraStream : (remote?.camera ?? null),
        connecting: !isSelf && remote?.connection !== "connected",
      };
    });
  }, [state.participants, state.remote, self, m.micOn, m.camOn, m.cameraStream]);

  const sharer = state.participants.find((p) => p.id === state.screenSharerId);
  const share = state.screenSharerId
    ? {
        name: sharer?.display_name ?? "Someone",
        isSelf: state.screenSharerId === self.id,
        stream: state.screenSharerId === self.id ? m.screenStream : (state.remote[state.screenSharerId]?.screen ?? null),
      }
    : null;
  const sharingMine = !!m.screenTrack;
  const handRaised = state.participants.find((p) => p.id === self.id)?.hand_raised ?? false;

  const toggleShare = async () => {
    if (sharingMine) return media.stopScreenShare();
    if (state.screenSharerId && state.screenSharerId !== self.id) {
      return setLocalNotice(`${sharer?.display_name ?? "Someone"} is already sharing their screen`);
    }
    await media.startScreenShare();
  };

  const copy = async (text: string, what: string) => {
    setLocalNotice((await copyToClipboard(text)) ? `${what} copied to clipboard` : "Couldn't copy");
  };

  const togglePanel = (next: Exclude<Panel, null>) => {
    const value = panel === next ? null : next;
    setPanel(value);
    client.setChatOpen(value === "chat");
  };

  // Zoom's keyboard shortcuts: Alt+A mute/unmute, Alt+V start/stop video.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.code === "KeyA") void media.setMic(!media.getSnapshot().micOn);
      if (e.code === "KeyV") void media.setCam(!media.getSnapshot().camOn);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [media]);

  useEffect(() => {
    if (!localNotice) return;
    const t = setTimeout(() => setLocalNotice(null), 3000);
    return () => clearTimeout(t);
  }, [localNotice]);

  const notice = localNotice ?? state.notice?.text;
  const leave = () => {
    client.leave();
    onExit("left");
  };

  if (state.status === "waiting") return <WaitingRoomScreen title={meeting.title} onLeave={leave} />;

  return (
    <div className="flex h-full flex-col bg-meeting-bg text-white">
      {/* Top bar */}
      <header className="relative flex h-10 shrink-0 items-center justify-between px-2">
        <MeetingInfo meeting={meeting} passcode={passcode} inviteLink={inviteLink} onCopy={copy} />
        {sharingMine && (
          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-b-lg bg-[#23d959]/15 px-3 py-1 text-xs">
            <span className="size-2 rounded-full bg-[#23d959]" /> You are screen sharing
            <button
              type="button"
              onClick={() => media.stopScreenShare()}
              className="rounded bg-[#e02828] px-2 py-0.5 font-bold hover:bg-[#c81e1e]"
            >
              Stop Share
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setView(view === "gallery" ? "speaker" : "gallery")}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/80 hover:bg-white/10"
        >
          {view === "gallery" ? <UserSquare2 className="size-4" /> : <LayoutGrid className="size-4" />}
          {view === "gallery" ? "Speaker View" : "Gallery View"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 p-2">
          {state.status === "connecting" ? (
            <div className="flex size-full items-center justify-center text-sm text-white/60">Connecting…</div>
          ) : (
            <VideoStage
              tiles={tiles}
              view={view}
              speakingIds={speakingIds}
              reactions={state.reactions}
              share={share}
              spotlightId={spotlightId}
            />
          )}

          {isHost && panel !== "participants" && (
            <WaitingRoomAlert
              waiting={state.waiting}
              onAdmit={(id) => client.admit(id)}
              onDeny={(id) => client.denyEntry(id)}
              onSeeAll={() => togglePanel("participants")}
            />
          )}

          {notice && (
            <div className="absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-black/80 px-4 py-2 text-sm shadow-popover">
              {notice}
            </div>
          )}
        </main>

        {panel && (
          <aside className="flex w-full max-w-80 shrink-0 flex-col bg-white text-ink max-sm:absolute max-sm:inset-0 max-sm:z-40 max-sm:max-w-none">
            <div className="flex h-11 items-center justify-between border-b border-line px-4">
              <h2 className="text-sm font-bold">{panel === "chat" ? "Meeting Chat" : `Participants (${tiles.length})`}</h2>
              <button type="button" onClick={() => togglePanel(panel)} aria-label="Close panel" className="rounded p-1 hover:bg-surface-hover">
                <X className="size-4" />
              </button>
            </div>
            {panel === "chat" ? (
              <ChatPanel
                messages={state.messages}
                selfId={state.selfId}
                canChat={isHost || meeting.settings.allow_chat}
                onSend={(text) => client.sendChat(text)}
              />
            ) : (
              <ParticipantsPanel
                people={tiles}
                isHost={isHost}
                waiting={state.waiting}
                onAdmit={(id) => client.admit(id)}
                onAdmitAll={() => client.admitAll()}
                onDeny={(id) => client.denyEntry(id)}
                onInvite={() => copy(inviteLink, "Invite link")}
                onMuteAll={() => client.muteAll()}
                onMute={(id) => client.muteParticipant(id)}
                onAskUnmute={(id) => client.askToUnmute(id)}
                onRemove={(id) => client.removeParticipant(id)}
              />
            )}
          </aside>
        )}
      </div>

      <Toolbar
        micOn={m.micOn}
        camOn={m.camOn}
        camBusy={m.camStarting}
        sharing={sharingMine}
        handRaised={handRaised}
        participantCount={tiles.length}
        unreadChat={state.unreadChat}
        panel={panel}
        isHost={isHost}
        onToggleMic={() => media.setMic(!m.micOn)}
        onToggleCam={() => media.setCam(!m.camOn)}
        onToggleShare={toggleShare}
        onTogglePanel={togglePanel}
        onReact={(emoji) => client.react(emoji)}
        onToggleHand={() => client.setHandRaised(!handRaised)}
        onCopyInvite={() => copy(inviteLink, "Invite link")}
        onLeave={leave}
        onEndForAll={() => client.endForAll()}
      />

      {/* Everyone else's microphone */}
      {Object.entries(state.remote).map(([id, r]) => (
        <RemoteAudio key={id} stream={r.camera} />
      ))}

      {state.unmuteRequested && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-label="Unmute request" className="w-full max-w-sm rounded-xl bg-white p-5 text-ink">
            <p className="font-bold">The host would like you to unmute</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="soft" onClick={() => client.dismissUnmuteRequest()}>
                Stay Muted
              </Button>
              <Button
                onClick={() => {
                  void media.setMic(true);
                  client.dismissUnmuteRequest();
                }}
              >
                Unmute
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
