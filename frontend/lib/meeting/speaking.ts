/**
 * Detects who is talking by measuring audio volume with the Web Audio API (for Zoom's green border).
 * Call `setTracks` with the current audio track of every participant; read `speakingIds`.
 */
import { Store } from "./store";

const POLL_MS = 200;
const THRESHOLD = 0.02; // RMS volume that counts as speech
const HOLD_MS = 800; // keep the border a moment after someone stops, so it doesn't flicker

interface Monitor {
  track: MediaStreamTrack;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  lastLoud: number;
}

export interface SpeakingState {
  speakingIds: number[];
  /** Most recent speakers first, for Zoom's speaker view */
  recentSpeakers: number[];
}

export class SpeakingDetector extends Store<SpeakingState> {
  private ctx: AudioContext | null = null;
  private monitors = new Map<number, Monitor>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private buffer = new Float32Array(512);

  constructor() {
    super({ speakingIds: [], recentSpeakers: [] });
  }

  setTracks(tracks: Map<number, MediaStreamTrack | null>) {
    for (const [id, monitor] of this.monitors) {
      if (tracks.get(id) !== monitor.track) this.removeMonitor(id);
    }
    for (const [id, track] of tracks) {
      if (track && !this.monitors.has(id) && track.readyState === "live") this.addMonitor(id, track);
    }
    if (this.monitors.size && !this.timer) this.timer = setInterval(() => this.poll(), POLL_MS);
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    [...this.monitors.keys()].forEach((id) => this.removeMonitor(id));
    void this.ctx?.close();
    this.ctx = null;
  }

  private addMonitor(id: number, track: MediaStreamTrack) {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === "suspended") void this.ctx.resume();
      const source = this.ctx.createMediaStreamSource(new MediaStream([track]));
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser); // not connected to the speakers: measuring only
      this.monitors.set(id, { track, source, analyser, lastLoud: 0 });
    } catch {
      // Web Audio unavailable: the room still works, just without the speaking border.
    }
  }

  private removeMonitor(id: number) {
    const m = this.monitors.get(id);
    if (!m) return;
    m.source.disconnect();
    this.monitors.delete(id);
  }

  private poll() {
    const now = Date.now();
    const speaking: number[] = [];
    for (const [id, m] of this.monitors) {
      if (!m.track.enabled || m.track.muted) continue;
      m.analyser.getFloatTimeDomainData(this.buffer);
      let sum = 0;
      for (const v of this.buffer) sum += v * v;
      if (Math.sqrt(sum / this.buffer.length) > THRESHOLD) m.lastLoud = now;
      if (now - m.lastLoud < HOLD_MS) speaking.push(id);
    }
    const prev = this.state.speakingIds;
    if (speaking.length !== prev.length || speaking.some((id, i) => id !== prev[i])) {
      const recent = [...speaking, ...this.state.recentSpeakers.filter((id) => !speaking.includes(id))];
      this.setState({ speakingIds: speaking, recentSpeakers: recent });
    }
  }
}
