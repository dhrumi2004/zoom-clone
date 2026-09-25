/**
 * One WebRTC connection to one other participant (the meeting is a "mesh": everyone connects to everyone).
 *
 * Every connection has three fixed slots (transceivers), in this order:
 *   0 = microphone, 1 = camera, 2 = screen share
 * Turning the camera or screen share on/off only swaps the track in its slot (replaceTrack),
 * so no renegotiation is needed, and the receiver knows what a track is from its slot.
 */
import type { SignalData } from "./types";

export const SLOT = { audio: 0, camera: 1, screen: 2 } as const;
const SLOT_KINDS = ["audio", "video", "video"] as const;

export type LocalTracks = [MediaStreamTrack | null, MediaStreamTrack | null, MediaStreamTrack | null];

export class Peer {
  readonly pc: RTCPeerConnection;
  /** Remote microphone + camera (a new object whenever a track arrives). */
  cameraStream = new MediaStream();
  screenStream = new MediaStream();
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isOfferer = false;
  /** Signals are processed strictly one after another (WebRTC calls are async and must not overlap). */
  private queue: Promise<void> = Promise.resolve();

  constructor(
    readonly remoteId: number,
    iceServers: RTCIceServer[],
    private sendSignal: (data: SignalData) => void,
    private onChange: () => void,
  ) {
    this.pc = new RTCPeerConnection({ iceServers });

    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.sendSignal({ type: "candidate", candidate: e.candidate.toJSON() });
    };

    this.pc.ontrack = (e) => {
      const slot = this.pc.getTransceivers().indexOf(e.transceiver);
      if (slot === SLOT.screen) {
        this.screenStream = new MediaStream([e.track]);
      } else {
        // Keep the other kind's track and replace this kind's (audio + camera share one stream).
        const others = this.cameraStream.getTracks().filter((t) => t.kind !== e.track.kind);
        this.cameraStream = new MediaStream([...others, e.track]);
      }
      this.onChange();
    };

    this.pc.onconnectionstatechange = () => {
      // A network change (e.g. Wi-Fi switch) can break the path; the offerer restarts ICE to find a new one.
      if (this.pc.connectionState === "failed" && this.isOfferer) void this.restartIce();
      this.onChange();
    };
  }

  get connectionState(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  /** The newcomer calls this for every participant already in the room. */
  async startAsOfferer(tracks: LocalTracks) {
    this.isOfferer = true;
    SLOT_KINDS.forEach((kind) => this.pc.addTransceiver(kind, { direction: "sendrecv" }));
    await this.applyTracks(tracks);
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sendSignal({ type: "offer", sdp: offer.sdp! });
  }

  receive(data: SignalData, tracks: LocalTracks) {
    this.queue = this.queue
      .then(() => this.handleSignal(data, tracks))
      .catch((err) => console.warn(`Signal from ${this.remoteId} failed`, err));
  }

  private async handleSignal(data: SignalData, tracks: LocalTracks) {
    if (data.type === "offer") {
      await this.pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
      // The offer created our three transceivers (receive-only); make them send too and attach our tracks.
      this.pc.getTransceivers().forEach((t) => (t.direction = "sendrecv"));
      await this.applyTracks(tracks);
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.sendSignal({ type: "answer", sdp: answer.sdp! });
      await this.flushCandidates();
    } else if (data.type === "answer") {
      await this.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
      await this.flushCandidates();
    } else if (data.type === "candidate") {
      // Candidates can arrive before the offer/answer; hold them until we can use them.
      if (this.pc.remoteDescription) await this.pc.addIceCandidate(data.candidate).catch(() => {});
      else this.pendingCandidates.push(data.candidate);
    }
  }

  /** Waiting for an answer to our own offer. */
  get awaitingAnswer(): boolean {
    return this.pc.signalingState === "have-local-offer";
  }

  async setTrack(slot: number, track: MediaStreamTrack | null) {
    const transceiver = this.pc.getTransceivers()[slot];
    if (transceiver) await transceiver.sender.replaceTrack(track).catch(() => {});
  }

  close() {
    this.pc.onicecandidate = this.pc.ontrack = this.pc.onconnectionstatechange = null;
    this.pc.close();
  }

  private async applyTracks(tracks: LocalTracks) {
    await Promise.all(tracks.map((track, slot) => this.setTrack(slot, track)));
  }

  private async flushCandidates() {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) await this.pc.addIceCandidate(candidate).catch(() => {});
  }

  private async restartIce() {
    const offer = await this.pc.createOffer({ iceRestart: true });
    await this.pc.setLocalDescription(offer);
    this.sendSignal({ type: "offer", sdp: offer.sdp! });
  }
}
