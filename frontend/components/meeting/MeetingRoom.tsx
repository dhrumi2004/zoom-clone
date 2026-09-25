"use client";

import { Circle, LayoutGrid, Lock, UserSquare2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDisposable } from "@/hooks/useDisposable";
import { useElapsed } from "@/hooks/useElapsed";
import { speechRecognitionSupported, useSpeechCaptions } from "@/hooks/useSpeechCaptions";
import { copyToClipboard } from "@/lib/invite";
import { MeetingClient } from "@/lib/meeting/client";
import { LocalMedia } from "@/lib/meeting/localMedia";
import { MeetingRecorder, recordingSupported } from "@/lib/meeting/recorder";
import { SpeakingDetector } from "@/lib/meeting/speaking";
import { useStore } from "@/lib/meeting/store";
import { prefs } from "@/lib/storage";
import type { MeetingPublic, Participant } from "@/lib/types";
import { BreakoutDialog } from "./BreakoutDialog";
import { ChatPanel } from "./ChatPanel";
import type { ExitReason } from "./EndScreen";
import { MeetingInfo } from "./MeetingInfo";
import { participantActions } from "./participantActions";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { PollsPanel } from "./PollsPanel";
import { RemoteAudio } from "./RemoteAudio";
import { RenameDialog } from "./RenameDialog";
import { SecurityMenu } from "./SecurityMenu";
import { Panel, Toolbar } from "./Toolbar";
import { ViewMode, VideoStage } from "./VideoStage";
import type { TileInfo } from "./VideoTile";
import { WaitingRoomAlert, WaitingRoomScreen } from "./WaitingRoom";

interface Props {
  meeting: MeetingPublic;
  self: Participant;
  media: LocalMedia;
  passcode: string | null;
  onExit: (reason: ExitReason, detail?: string | null) => void;
}

const CAPTION_TTL_MS = 5000;
const PANEL_TITLES: Record<Exclude<Panel, null>, string> = { chat: "Meeting Chat", participants: "Participants", polls: "Polls" };

export function MeetingRoom({ meeting, self, media, passcode, onExit }: Props) {
  const client = useDisposable(
    () => new MeetingClient(meeting.meeting_code, self.id, media),
    (c) => c.leave(),
  );
  const detector = useDisposable(
    () => new SpeakingDetector(),
    (d) => d.destroy(),
  );
  const recorder = useRef<MeetingRecorder | null>(null);
  const state = useStore(client);
  const m = useStore(media);
  const { speakingIds, recentSpeakers } = useStore(detector);

  const [view, setView] = useState<ViewMode>("gallery");
  const [panel, setPanel] = useState<Panel>(null);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const [selfViewHidden, setSelfViewHidden] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [recordingMine, setRecordingMine] = useState(false);
  const [renaming, setRenaming] = useState<TileInfo | null>(null);
  const [removing, setRemoving] = useState<TileInfo | null>(null);
  const [breakoutDialog, setBreakoutDialog] = useState(false);
  const [speakerId, setSpeakerId] = useState(() => prefs.speakerId() ?? "");
  const [seenPollId, setSeenPollId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const isHost = self.role === "host";
  const selfState = state.participants.find((p) => p.id === self.id);
  const isModerator = isHost || !!selfState?.is_cohost;
  const settings = state.security?.settings ?? meeting.settings;
  const inviteLink = `${window.location.origin}/j/${meeting.meeting_code}${passcode ? `?pwd=${passcode}` : ""}`;
  const elapsed = useElapsed(meeting.started_at);

  useEffect(() => client.connect(), [client]);

  // Leave the room UI when the server says we're done (ended, removed, lost connection...).
  useEffect(() => {
    if (!["connecting", "waiting", "connected"].includes(state.status)) onExit(state.status as ExitReason, state.error);
  }, [state.status, state.error, onExit]);

  // Feed every participant's microphone to the speaking detector.
  useEffect(() => {
    const tracks = new Map<number, MediaStreamTrack | null>();
    tracks.set(self.id, m.micOn ? m.audioTrack : null);
    for (const [id, r] of Object.entries(state.remote)) tracks.set(Number(id), r.camera.getAudioTracks()[0] ?? null);
    detector.setTracks(tracks);
  }, [detector, state.remote, m.audioTrack, m.micOn, self.id]);

  // Captions fade out after a few seconds; tick while they're on screen.
  useEffect(() => {
    if (!captionsOn) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [captionsOn]);

  // Your own speech -> captions for everyone (Chrome/Edge). Only while your mic is on, like Zoom.
  const ownCaption = useSpeechCaptions(captionsOn && m.micOn, (text, final) => client.sendCaption(text, final));

  const tiles: TileInfo[] = useMemo(() => {
    const list = state.participants.length
      ? state.participants
      : [{ ...self, hand_raised: false, is_sharing: false, is_cohost: false }];
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
        isCohost: p.is_cohost,
        micMuted: isSelf ? !m.micOn : p.is_muted,
        videoOn: isSelf ? m.camOn : !p.is_video_off,
        handRaised: p.hand_raised,
        stream: isSelf ? m.cameraStream : (remote?.camera ?? null),
        connecting: !isSelf && remote?.connection !== "connected",
      };
    });
  }, [state.participants, state.remote, self, m.micOn, m.camOn, m.cameraStream]);
  const shownTiles = selfViewHidden && tiles.length > 1 ? tiles.filter((t) => !t.isSelf) : tiles;

  const actionContext = {
    client,
    isHost,
    isModerator,
    allowRename: settings.allow_rename,
    spotlightId: state.spotlightId,
    pinnedId,
    setPinned: setPinnedId,
    onRename: setRenaming,
    onRemove: setRemoving,
  };
  const menuFor = (t: TileInfo) => participantActions(t, actionContext);

  const sharer = state.participants.find((p) => p.id === state.screenSharerId);
  const share = state.screenSharerId
    ? {
        name: sharer?.display_name ?? "Someone",
        isSelf: state.screenSharerId === self.id,
        stream: state.screenSharerId === self.id ? m.screenStream : (state.remote[state.screenSharerId]?.screen ?? null),
      }
    : null;
  const sharingMine = !!m.screenTrack;
  const handRaised = selfState?.hand_raised ?? false;
  const openPoll = [...state.polls].reverse().find((p) => p.status === "open");
  const unseenPoll = !isModerator && openPoll && openPoll.id !== seenPollId && panel !== "polls" ? openPoll : null;

  const toggleMic = () => {
    // Security > "Allow participants to unmute themselves" is off and the host muted you
    if (!m.micOn && !isModerator && !settings.allow_unmute && selfState?.is_muted) {
      return setLocalNotice("The host has disabled unmuting. Raise your hand to ask to speak.");
    }
    void media.setMic(!m.micOn);
  };

  const toggleShare = async () => {
    if (sharingMine) return media.stopScreenShare();
    if (!isModerator && !settings.allow_screen_share) return setLocalNotice("The host has disabled screen sharing.");
    if (state.screenSharerId && state.screenSharerId !== self.id) {
      return setLocalNotice(`${sharer?.display_name ?? "Someone"} is already sharing their screen`);
    }
    await media.startScreenShare();
  };

  const toggleRecording = async () => {
    if (recordingMine) return recorder.current?.stop(meeting.title);
    if (!recordingSupported()) return setLocalNotice("Recording isn't supported in this browser.");
    const rec = new MeetingRecorder();
    rec.onStopped = () => {
      client.setRecording(false);
      setRecordingMine(false);
      setLocalNotice("Recording saved to your Downloads");
    };
    if (await rec.start(m.audioTrack)) {
      recorder.current = rec;
      setRecordingMine(true);
      client.setRecording(true);
    }
  };

  const toggleCaptions = () => {
    if (!captionsOn && !speechRecognitionSupported()) {
      setLocalNotice("Your browser can't transcribe speech. Captions from others will still show.");
    }
    setCaptionsOn((on) => !on);
  };

  const copy = async (text: string, what: string) => {
    setLocalNotice((await copyToClipboard(text)) ? `${what} copied to clipboard` : "Couldn't copy");
  };

  const togglePanel = (next: Exclude<Panel, null>) => {
    const value = panel === next ? null : next;
    setPanel(value);
    client.setChatOpen(value === "chat");
    if (value === "polls" && openPoll) setSeenPollId(openPoll.id);
  };

  const leave = () => {
    recorder.current?.stop(meeting.title); // save a recording in progress
    client.leave();
    onExit("left");
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
    const t = setTimeout(() => setLocalNotice(null), 3500);
    return () => clearTimeout(t);
  }, [localNotice]);

  const notice = localNotice ?? state.notice?.text;
  const nameOf = (id: number) => state.participants.find((p) => p.id === id)?.display_name ?? "Someone";
  const captions = captionsOn
    ? [
        ...Object.values(state.captions)
          .filter((c) => now - c.at < CAPTION_TTL_MS)
          .map((c) => ({ key: c.participantId, name: nameOf(c.participantId), text: c.text })),
        ...(ownCaption ? [{ key: self.id, name: "You", text: ownCaption }] : []),
      ].slice(-3)
    : [];

  if (state.status === "waiting") return <WaitingRoomScreen title={meeting.title} onLeave={leave} />;

  return (
    <div className="flex h-full flex-col bg-meeting-bg text-white">
      {/* Top bar */}
      <header className="relative flex h-10 shrink-0 items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <MeetingInfo meeting={meeting} passcode={passcode} inviteLink={inviteLink} onCopy={copy} />
          {state.recording && (
            <span className="flex items-center gap-1.5 rounded bg-black/40 px-2 py-0.5 text-xs">
              <Circle className="size-2.5 animate-pulse fill-[#e02828] text-[#e02828]" /> Recording
            </span>
          )}
          {state.security?.locked && <Lock className="size-3.5 text-white/70" aria-label="Meeting locked" />}
        </div>

        {sharingMine ? (
          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-b-lg bg-[#23d959]/15 px-3 py-1 text-xs">
            <span className="size-2 rounded-full bg-[#23d959]" /> You are screen sharing
            <button type="button" onClick={() => media.stopScreenShare()} className="rounded bg-[#e02828] px-2 py-0.5 font-bold hover:bg-[#c81e1e]">
              Stop Share
            </button>
          </div>
        ) : (
          state.roomName && (
            <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-b-lg bg-zoom-blue/25 px-3 py-1 text-xs">
              Breakout room: <b>{state.roomName}</b>
              <button type="button" onClick={() => client.joinBreakout(0)} className="rounded bg-white/15 px-2 py-0.5 font-bold hover:bg-white/25">
                Leave room
              </button>
            </div>
          )
        )}

        <div className="flex items-center gap-2">
          {elapsed && <span className="text-xs text-white/60 tabular-nums">{elapsed}</span>}
          <button
            type="button"
            onClick={() => setView(view === "gallery" ? "speaker" : "gallery")}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/80 hover:bg-white/10"
          >
            {view === "gallery" ? <UserSquare2 className="size-4" /> : <LayoutGrid className="size-4" />}
            <span className="hidden sm:inline">{view === "gallery" ? "Speaker View" : "Gallery View"}</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 p-2">
          {state.status === "connecting" ? (
            <div className="flex size-full items-center justify-center text-sm text-white/60">Connecting…</div>
          ) : (
            <VideoStage
              tiles={shownTiles}
              view={view}
              speakingIds={speakingIds}
              reactions={state.reactions}
              share={share}
              activeSpeakerId={recentSpeakers.find((id) => id !== self.id) ?? null}
              pinnedId={pinnedId}
              spotlightId={state.spotlightId}
              menuFor={menuFor}
            />
          )}

          {isModerator && panel !== "participants" && (
            <WaitingRoomAlert
              waiting={state.waiting}
              onAdmit={(id) => client.admit(id)}
              onDeny={(id) => client.denyEntry(id)}
              onSeeAll={() => togglePanel("participants")}
            />
          )}

          {unseenPoll && (
            <div className="absolute top-3 right-3 z-30 w-72 rounded-xl bg-white p-4 text-ink shadow-popover">
              <p className="text-sm">
                <b>The host started a poll:</b> {unseenPoll.question}
              </p>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={() => togglePanel("polls")}>
                  Answer poll
                </Button>
              </div>
            </div>
          )}

          {notice && (
            <div className="absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-black/80 px-4 py-2 text-sm shadow-popover">{notice}</div>
          )}

          {captions.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-1 px-4" aria-live="polite">
              {captions.map((c) => (
                <p key={c.key} className="max-w-3xl rounded bg-black/75 px-3 py-1 text-center text-base">
                  <span className="font-bold text-white/70">{c.name}: </span>
                  {c.text}
                </p>
              ))}
            </div>
          )}
        </main>

        {panel && (
          <aside className="flex w-full max-w-80 shrink-0 flex-col bg-white text-ink max-sm:absolute max-sm:inset-0 max-sm:z-40 max-sm:max-w-none">
            <div className="flex h-11 items-center justify-between border-b border-line px-4">
              <h2 className="text-sm font-bold">
                {PANEL_TITLES[panel]}
                {panel === "participants" && ` (${tiles.length})`}
              </h2>
              <button type="button" onClick={() => togglePanel(panel)} aria-label="Close panel" className="rounded p-1 hover:bg-surface-hover">
                <X className="size-4" />
              </button>
            </div>
            {panel === "chat" && (
              <ChatPanel
                messages={state.messages}
                selfId={state.selfId}
                people={tiles.filter((t) => !t.isSelf).map((t) => ({ id: t.id, name: t.name, isModerator: t.isHost || t.isCohost }))}
                canChatEveryone={isModerator || settings.allow_chat}
                onSend={(text, toId) => client.sendChat(text, toId)}
              />
            )}
            {panel === "participants" && (
              <ParticipantsPanel
                people={tiles}
                isModerator={isModerator}
                waiting={state.waiting}
                menuFor={menuFor}
                onAdmit={(id) => client.admit(id)}
                onAdmitAll={() => client.admitAll()}
                onDeny={(id) => client.denyEntry(id)}
                onInvite={() => copy(inviteLink, "Invite link")}
                onMuteAll={() => client.muteAll()}
                onLowerAllHands={() => client.lowerAllHands()}
                onMute={(id) => client.muteParticipant(id)}
                onAskUnmute={(id) => client.askToUnmute(id)}
              />
            )}
            {panel === "polls" && <PollsPanel polls={state.polls} client={client} isModerator={isModerator} />}
          </aside>
        )}
      </div>

      <Toolbar
        media={media}
        sharing={sharingMine}
        handRaised={handRaised}
        participantCount={tiles.length}
        unreadChat={state.unreadChat}
        panel={panel}
        isHost={isHost}
        isModerator={isModerator}
        recording={recordingMine}
        captionsOn={captionsOn}
        selfViewHidden={selfViewHidden}
        hasOpenPoll={!!openPoll}
        speakerId={speakerId}
        security={<SecurityMenu security={state.security} client={client} />}
        onToggleMic={toggleMic}
        onToggleCam={() => media.setCam(!m.camOn)}
        onToggleShare={toggleShare}
        onTogglePanel={togglePanel}
        onReact={(emoji) => client.react(emoji)}
        onToggleHand={() => client.setHandRaised(!handRaised)}
        onCopyInvite={() => copy(inviteLink, "Invite link")}
        onToggleRecording={toggleRecording}
        onToggleCaptions={toggleCaptions}
        onOpenBreakouts={() => setBreakoutDialog(true)}
        onToggleSelfView={() => setSelfViewHidden((h) => !h)}
        onSpeakerChange={(id) => {
          prefs.setSpeakerId(id);
          setSpeakerId(id);
        }}
        onLeave={leave}
        onEndForAll={() => client.endForAll()}
      />

      {/* Everyone else's microphone */}
      {Object.entries(state.remote).map(([id, r]) => (
        <RemoteAudio key={id} stream={r.camera} speakerId={speakerId} />
      ))}

      <RenameDialog
        person={renaming}
        onClose={() => setRenaming(null)}
        onSave={(name) => renaming && client.rename(name, renaming.isSelf ? undefined : renaming.id)}
      />
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ""}?`}
        message="They will be removed from the meeting and won't be able to rejoin."
        confirmLabel="Remove"
        onConfirm={() => {
          if (removing) client.removeParticipant(removing.id);
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
      {isModerator && (
        <BreakoutDialog
          open={breakoutDialog}
          onClose={() => setBreakoutDialog(false)}
          client={client}
          breakout={state.breakout}
          people={tiles}
          myRoomId={state.roomId}
        />
      )}

      {state.unmuteRequested && (
        <PromptDialog
          label="Unmute request"
          text="The host would like you to unmute"
          cancel="Stay Muted"
          confirm="Unmute"
          onCancel={() => client.dismissUnmuteRequest()}
          onConfirm={() => {
            void media.setMic(true);
            client.dismissUnmuteRequest();
          }}
        />
      )}
      {state.videoRequested && (
        <PromptDialog
          label="Video request"
          text="The host has asked you to start your video"
          cancel="Later"
          confirm="Start My Video"
          onCancel={() => client.dismissVideoRequest()}
          onConfirm={() => {
            void media.setCam(true);
            client.dismissVideoRequest();
          }}
        />
      )}
    </div>
  );
}

function PromptDialog({
  label,
  text,
  cancel,
  confirm,
  onCancel,
  onConfirm,
}: {
  label: string;
  text: string;
  cancel: string;
  confirm: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label={label} className="w-full max-w-sm rounded-xl bg-white p-5 text-ink">
        <p className="font-bold">{text}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="soft" onClick={onCancel}>
            {cancel}
          </Button>
          <Button onClick={onConfirm}>{confirm}</Button>
        </div>
      </div>
    </div>
  );
}
