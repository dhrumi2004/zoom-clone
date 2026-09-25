/**
 * Everything that happens while you're in a meeting: the WebSocket to the server, one Peer per
 * other participant, chat, reactions and host commands. React components read `client.getSnapshot()`
 * through useStore(client) and call methods like client.sendChat().
 *
 * Connection flow: the newcomer gets `room_state` and sends a WebRTC offer to every peer in it;
 * the others answer when the offer arrives. The server only relays these signals.
 */
import { ICE_SERVERS, WS_URL } from "@/lib/config";
import { LocalMedia, LocalMediaState } from "./localMedia";
import { LocalTracks, Peer, SLOT } from "./peer";
import { Store } from "./store";
import {
  BreakoutState,
  ChatMessage,
  CLOSE_CODES,
  Poll,
  RoomParticipant,
  SecurityState,
  ServerMessage,
  WaitingPerson,
} from "./types";

export type ConnectionStatus = "connecting" | "waiting" | "connected" | "disconnected" | "ended" | "removed" | "replaced" | "failed";

export interface RemoteMedia {
  camera: MediaStream;
  screen: MediaStream;
  connection: RTCPeerConnectionState;
}

export interface Caption {
  participantId: number;
  text: string;
  final: boolean;
  at: number;
}

export interface Reaction {
  key: number;
  participantId: number;
  emoji: string;
}

export interface MeetingState {
  status: ConnectionStatus;
  selfId: number | null;
  participants: RoomParticipant[];
  messages: ChatMessage[];
  unreadChat: number;
  screenSharerId: number | null;
  remote: Record<number, RemoteMedia>;
  reactions: Reaction[];
  /** One-line message shown briefly at the top of the room ("The host muted you"). */
  notice: { key: number; text: string } | null;
  unmuteRequested: boolean;
  /** Hosts: people in the waiting room */
  waiting: WaitingPerson[];
  error: string | null;
  /** 0 = main room; breakout rooms have a name */
  roomId: number;
  roomName: string | null;
  spotlightId: number | null;
  security: SecurityState | null;
  /** Someone in the meeting is recording */
  recording: boolean;
  /** Latest caption line per speaker */
  captions: Record<number, Caption>;
  polls: Poll[];
  breakout: BreakoutState;
  videoRequested: boolean;
}

const REACTION_MS = 4000;
let counter = 0;

export class MeetingClient extends Store<MeetingState> {
  private ws: WebSocket | null = null;
  private peers = new Map<number, Peer>();
  private outbox: string[] = [];
  private lastMedia: LocalMediaState;
  private unsubscribeMedia: (() => void) | null = null;
  private chatOpen = false;

  constructor(
    private code: string,
    private participantId: number,
    private media: LocalMedia,
  ) {
    super({
      status: "connecting",
      selfId: null,
      participants: [],
      messages: [],
      unreadChat: 0,
      screenSharerId: null,
      remote: {},
      reactions: [],
      notice: null,
      unmuteRequested: false,
      waiting: [],
      error: null,
      roomId: 0,
      roomName: null,
      spotlightId: null,
      security: null,
      recording: false,
      captions: {},
      polls: [],
      breakout: { open: false, rooms: [] },
      videoRequested: false,
    });
    this.lastMedia = media.getSnapshot();
  }

  // ---------- lifecycle ----------

  /** Idempotent, so React's development double-mount doesn't open two sockets. */
  connect() {
    if (this.ws) return;
    const ws = new WebSocket(`${WS_URL}/ws/meetings/${this.code}?participant_id=${this.participantId}`);
    this.ws = ws;
    ws.onopen = () => {
      this.outbox.forEach((m) => ws.send(m));
      this.outbox = [];
    };
    ws.onmessage = (e) => this.handle(JSON.parse(e.data) as ServerMessage);
    ws.onclose = (e) => this.handleClose(e.code);
    this.unsubscribeMedia = this.media.subscribe(() => this.syncLocalMedia());
  }

  /** Leave: closing the socket tells the server we left. */
  leave() {
    this.unsubscribeMedia?.();
    this.unsubscribeMedia = null;
    this.peers.forEach((p) => p.close());
    this.peers.clear();
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) {
      this.ws.onclose = null;
      this.ws.close(1000);
    }
  }

  // ---------- actions ----------

  /** `toId` sends a private message to one participant. */
  sendChat(content: string, toId?: number | null) {
    const text = content.trim();
    if (text) this.send({ type: "chat", content: text, ...(toId ? { to_id: toId } : {}) });
  }
  rename(name: string, targetId?: number) {
    this.send({ type: "rename", name, ...(targetId ? { target_id: targetId } : {}) });
  }
  sendCaption(text: string, final: boolean) {
    this.send({ type: "caption", text, final });
  }
  react(emoji: string) {
    this.send({ type: "reaction", emoji });
  }
  setHandRaised(raised: boolean) {
    this.send({ type: "raise_hand", raised });
  }
  muteAll() {
    this.send({ type: "mute_all" });
  }
  muteParticipant(targetId: number) {
    this.send({ type: "mute_participant", target_id: targetId });
  }
  askToUnmute(targetId: number) {
    this.send({ type: "ask_unmute", target_id: targetId });
  }
  removeParticipant(targetId: number) {
    this.send({ type: "remove_participant", target_id: targetId });
  }
  endForAll() {
    this.send({ type: "end_meeting" });
  }
  stopVideo(targetId: number) {
    this.send({ type: "stop_video", target_id: targetId });
  }
  askToStartVideo(targetId: number) {
    this.send({ type: "ask_start_video", target_id: targetId });
  }
  lowerAllHands() {
    this.send({ type: "lower_all_hands" });
  }
  lowerHand(targetId: number) {
    this.send({ type: "lower_hand", target_id: targetId });
  }
  spotlight(targetId: number | null) {
    this.send({ type: "spotlight", target_id: targetId });
  }
  setCohost(targetId: number, value: boolean) {
    this.send({ type: "set_cohost", target_id: targetId, value });
  }
  updateSecurity(change: Partial<{ locked: boolean } & SecurityState["settings"]>) {
    this.send({ type: "security", ...change });
  }
  setRecording(active: boolean) {
    this.send({ type: "recording", active });
  }
  createPoll(question: string, options: string[], anonymous: boolean) {
    this.send({ type: "poll_create", question, options, anonymous });
  }
  vote(pollId: number, optionId: number) {
    this.send({ type: "poll_vote", poll_id: pollId, option_id: optionId });
  }
  endPoll(pollId: number) {
    this.send({ type: "poll_end", poll_id: pollId });
  }
  sharePollResults(pollId: number, shared: boolean) {
    this.send({ type: "poll_share", poll_id: pollId, shared });
  }
  openBreakouts(rooms: { name: string; participant_ids: number[] }[]) {
    this.send({ type: "breakout_open", rooms });
  }
  assignBreakout(targetId: number, roomId: number) {
    this.send({ type: "breakout_assign", target_id: targetId, room_id: roomId });
  }
  joinBreakout(roomId: number) {
    this.send({ type: "breakout_join", room_id: roomId });
  }
  closeBreakouts() {
    this.send({ type: "breakout_close" });
  }
  dismissVideoRequest() {
    this.setState({ videoRequested: false });
  }
  admit(targetId: number) {
    this.send({ type: "admit", target_id: targetId });
  }
  admitAll() {
    this.send({ type: "admit_all" });
  }
  denyEntry(targetId: number) {
    this.send({ type: "deny", target_id: targetId });
  }
  dismissUnmuteRequest() {
    this.setState({ unmuteRequested: false });
  }
  /** The chat panel tells the client when it's visible, to keep the unread badge right. */
  setChatOpen(open: boolean) {
    this.chatOpen = open;
    if (open) this.setState({ unreadChat: 0 });
  }

  // ---------- incoming ----------

  private handle(msg: ServerMessage) {
    switch (msg.type) {
      case "room_state": {
        // A second room_state means we moved (breakout rooms): drop every connection from the old room.
        const moved = this.state.status === "connected" && msg.room_id !== this.state.roomId;
        if (moved) [...this.peers.keys()].forEach((id) => this.closePeer(id));
        this.setState({
          status: "connected",
          selfId: msg.self_id,
          participants: msg.participants,
          messages: msg.messages,
          screenSharerId: msg.screen_sharer_id,
          waiting: msg.waiting ?? [],
          roomId: msg.room_id,
          roomName: msg.room_name,
          spotlightId: msg.spotlight_id,
          recording: msg.recording,
          polls: msg.polls,
          security: msg.security,
          breakout: msg.breakout,
          captions: {},
        });
        if (moved) this.notify(msg.room_name ? `You joined ${msg.room_name}` : "You're back in the main room");
        // Report our real mic/camera state, then call everyone already here.
        this.sendMediaState(this.media.getSnapshot());
        if (this.media.getSnapshot().screenTrack) this.send({ type: "screen_share", active: true });
        for (const p of msg.participants) {
          if (p.id !== msg.self_id) void this.createPeer(p.id).startAsOfferer(this.localTracks());
        }
        break;
      }
      case "waiting_room":
        this.setState({ status: "waiting" });
        break;
      case "waiting_room_updated":
        this.setState({ waiting: msg.waiting });
        break;
      case "participant_joined":
        // A fresh connection from someone we knew means their old WebRTC session is gone; they'll offer again.
        this.closePeer(msg.participant.id);
        this.setState((s) => ({ participants: [...s.participants.filter((p) => p.id !== msg.participant.id), msg.participant] }));
        break;
      case "participant_left":
        this.closePeer(msg.participant_id);
        this.setState((s) => ({
          participants: s.participants.filter((p) => p.id !== msg.participant_id),
          screenSharerId: s.screenSharerId === msg.participant_id ? null : s.screenSharerId,
        }));
        break;
      case "participant_updated":
        this.setState((s) => ({
          participants: s.participants.map((p) => (p.id === msg.participant.id ? msg.participant : p)),
        }));
        break;
      case "signal": {
        let peer = this.peers.get(msg.from_id);
        // An offer while we're waiting on our own offer means they reconnected: start over with them.
        if (msg.data.type === "offer" && peer?.awaitingAnswer) {
          this.closePeer(msg.from_id);
          peer = undefined;
        }
        (peer ?? this.createPeer(msg.from_id)).receive(msg.data, this.localTracks());
        break;
      }
      case "chat":
        this.setState((s) => ({
          messages: [...s.messages, msg.message],
          unreadChat: this.chatOpen || msg.message.participant_id === s.selfId ? s.unreadChat : s.unreadChat + 1,
        }));
        break;
      case "reaction": {
        const reaction = { key: ++counter, participantId: msg.participant_id, emoji: msg.emoji };
        this.setState((s) => ({ reactions: [...s.reactions, reaction] }));
        setTimeout(() => this.setState((s) => ({ reactions: s.reactions.filter((r) => r.key !== reaction.key) })), REACTION_MS);
        break;
      }
      case "screen_share":
        this.setState((s) => ({
          screenSharerId: msg.active ? msg.participant_id : s.screenSharerId === msg.participant_id ? null : s.screenSharerId,
        }));
        break;
      case "force_mute":
        void this.media.setMic(false);
        this.notify("You have been muted by the host");
        break;
      case "unmute_request":
        this.setState({ unmuteRequested: true });
        break;
      case "removed":
        this.setState({ status: "removed" });
        break;
      case "meeting_ended":
        this.setState({ status: "ended" });
        break;
      case "force_video_off":
        void this.media.setCam(false);
        this.notify("The host has stopped your video");
        break;
      case "video_request":
        this.setState({ videoRequested: true });
        break;
      case "spotlight":
        this.setState({ spotlightId: msg.participant_id });
        break;
      case "cohost":
        this.notify(msg.value ? "You are now a co-host" : "You are no longer a co-host");
        break;
      case "security":
        this.setState({ security: { locked: msg.locked, settings: msg.settings } });
        break;
      case "recording":
        if (msg.active !== this.state.recording) this.notify(msg.active ? "This meeting is being recorded" : "Recording stopped");
        this.setState({ recording: msg.active });
        break;
      case "caption":
        this.setState((s) => ({
          captions: { ...s.captions, [msg.participant_id]: { participantId: msg.participant_id, text: msg.text, final: msg.final, at: Date.now() } },
        }));
        break;
      case "poll": {
        const known = this.state.polls.some((p) => p.id === msg.poll.id);
        this.setState((s) => ({
          polls: known ? s.polls.map((p) => (p.id === msg.poll.id ? msg.poll : p)) : [...s.polls, msg.poll],
        }));
        break;
      }
      case "breakout_state":
        this.setState({ breakout: { open: msg.open, rooms: msg.rooms } });
        break;
      case "error":
        if (msg.code === "someone_sharing" || msg.code === "share_disabled") this.media.stopScreenShare();
        if (msg.code === "unmute_disabled") void this.media.setMic(false);
        if (this.state.status === "connecting" || this.state.status === "waiting") this.setState({ error: msg.detail });
        else this.notify(msg.detail);
        break;
    }
  }

  private handleClose(code: number) {
    this.peers.forEach((p) => p.close());
    this.peers.clear();
    const terminal: ConnectionStatus[] = ["ended", "removed"];
    if (terminal.includes(this.state.status)) return;
    if (code === CLOSE_CODES.ended) this.setState({ status: "ended" });
    else if (code === CLOSE_CODES.removed) this.setState({ status: "removed" });
    else if (code === CLOSE_CODES.replaced) this.setState({ status: "replaced" });
    else if (code === CLOSE_CODES.invalid) this.setState({ status: "failed" });
    else this.setState({ status: "disconnected" });
  }

  // ---------- local media → peers ----------

  private localTracks(): LocalTracks {
    const m = this.media.getSnapshot();
    return [m.audioTrack, m.videoTrack, m.screenTrack];
  }

  private syncLocalMedia() {
    const next = this.media.getSnapshot();
    const prev = this.lastMedia;
    this.lastMedia = next;

    const changes: [number, MediaStreamTrack | null][] = [];
    if (next.audioTrack !== prev.audioTrack) changes.push([SLOT.audio, next.audioTrack]);
    if (next.videoTrack !== prev.videoTrack) changes.push([SLOT.camera, next.videoTrack]);
    if (next.screenTrack !== prev.screenTrack) changes.push([SLOT.screen, next.screenTrack]);
    for (const [slot, track] of changes) this.peers.forEach((p) => void p.setTrack(slot, track));

    if (next.micOn !== prev.micOn || next.camOn !== prev.camOn) this.sendMediaState(next);
    if (!!next.screenTrack !== !!prev.screenTrack) this.send({ type: "screen_share", active: !!next.screenTrack });
  }

  private sendMediaState(m: LocalMediaState) {
    this.send({ type: "media_state", is_muted: !m.micOn, is_video_off: !m.camOn });
  }

  // ---------- helpers ----------

  private createPeer(remoteId: number): Peer {
    const peer = new Peer(
      remoteId,
      ICE_SERVERS,
      (data) => this.send({ type: "signal", target_id: remoteId, data }),
      () => this.updateRemote(peer),
    );
    this.peers.set(remoteId, peer);
    this.updateRemote(peer);
    return peer;
  }

  private updateRemote(peer: Peer) {
    if (this.peers.get(peer.remoteId) !== peer) return; // an old, replaced connection
    this.setState((s) => ({
      remote: {
        ...s.remote,
        [peer.remoteId]: { camera: peer.cameraStream, screen: peer.screenStream, connection: peer.connectionState },
      },
    }));
  }

  private closePeer(remoteId: number) {
    this.peers.get(remoteId)?.close();
    this.peers.delete(remoteId);
    this.setState((s) => {
      const remote = { ...s.remote };
      delete remote[remoteId];
      return { remote };
    });
  }

  private send(message: object) {
    const data = JSON.stringify(message);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(data);
    else if (!this.ws || this.ws.readyState === WebSocket.CONNECTING) this.outbox.push(data);
  }

  private notify(text: string) {
    const notice = { key: ++counter, text };
    this.setState({ notice });
    setTimeout(() => this.state.notice?.key === notice.key && this.setState({ notice: null }), 4000);
  }
}
