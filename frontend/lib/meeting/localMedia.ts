/**
 * This browser's microphone, camera and screen share.
 *
 * - Mute keeps the mic track but disables it (instant, like Zoom).
 * - Stop Video releases the camera (the camera light turns off); Start Video asks for a new track.
 * - The MeetingClient listens for changes and swaps tracks on every peer connection.
 */
import { Store } from "./store";

export interface LocalMediaState {
  micOn: boolean;
  camOn: boolean;
  audioTrack: MediaStreamTrack | null;
  videoTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  /** New stream object whenever the camera track changes, for <video srcObject>. */
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  micError: string | null;
  camError: string | null;
  camStarting: boolean;
}

function describeMediaError(error: unknown, device: "camera" | "microphone"): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") return `Access to your ${device} is blocked. Allow it in your browser's site settings.`;
  if (name === "NotFoundError") return `No ${device} found.`;
  if (name === "NotReadableError") return `Your ${device} is being used by another app.`;
  if (typeof navigator !== "undefined" && !navigator.mediaDevices)
    return `Your browser can't access the ${device} on this page (it needs HTTPS or localhost).`;
  return `Couldn't start your ${device}.`;
}

export class LocalMedia extends Store<LocalMediaState> {
  private destroyed = false;
  private initialized = false;
  private micRequest: Promise<void> | null = null;

  constructor() {
    super({
      micOn: false,
      camOn: false,
      audioTrack: null,
      videoTrack: null,
      screenTrack: null,
      cameraStream: null,
      screenStream: null,
      micError: null,
      camError: null,
      camStarting: false,
    });
  }

  /** First-time setup from the user's join choices. Safe to call more than once. */
  init(audioOn: boolean, videoOn: boolean) {
    if (this.initialized) return;
    this.initialized = true;
    if (audioOn) void this.setMic(true);
    if (videoOn) void this.setCam(true);
  }

  async setMic(on: boolean): Promise<void> {
    if (on && !this.state.audioTrack) {
      // Several quick clicks must not open the microphone twice.
      this.micRequest ??= this.acquireMic();
      await this.micRequest;
      this.micRequest = null;
      if (!this.state.audioTrack) return;
    }
    if (this.state.audioTrack) this.state.audioTrack.enabled = on;
    this.setState({ micOn: on && !!this.state.audioTrack });
  }

  private async acquireMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const track = stream.getAudioTracks()[0];
      if (this.destroyed) return track.stop();
      this.setState({ audioTrack: track, micError: null });
    } catch (error) {
      this.setState({ micError: describeMediaError(error, "microphone"), micOn: false });
    }
  }

  async setCam(on: boolean): Promise<void> {
    if (!on) {
      this.state.videoTrack?.stop();
      this.setState({ videoTrack: null, cameraStream: null, camOn: false });
      return;
    }
    if (this.state.videoTrack || this.state.camStarting) return;

    this.setState({ camStarting: true });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
      const track = stream.getVideoTracks()[0];
      if (this.destroyed) return track.stop();
      track.onended = () => this.setCam(false); // camera unplugged / revoked
      this.setState({ videoTrack: track, cameraStream: new MediaStream([track]), camOn: true, camError: null });
    } catch (error) {
      this.setState({ camError: describeMediaError(error, "camera"), camOn: false });
    } finally {
      this.setState({ camStarting: false });
    }
  }

  /** Must be called from a click (browsers require a user gesture). Returns false if the user cancelled. */
  async startScreenShare(): Promise<boolean> {
    if (this.state.screenTrack) return true;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false });
      const track = stream.getVideoTracks()[0];
      if (this.destroyed) {
        track.stop();
        return false;
      }
      track.contentHint = "detail"; // favour sharp text over smooth motion
      track.onended = () => this.stopScreenShare(); // the browser's own "Stop sharing" button
      this.setState({ screenTrack: track, screenStream: new MediaStream([track]) });
      return true;
    } catch {
      return false;
    }
  }

  stopScreenShare() {
    this.state.screenTrack?.stop();
    this.setState({ screenTrack: null, screenStream: null });
  }

  /** Release every device (leaving the meeting or closing the page). */
  destroy() {
    this.destroyed = true;
    this.state.audioTrack?.stop();
    this.state.videoTrack?.stop();
    this.state.screenTrack?.stop();
    this.setState({
      audioTrack: null,
      videoTrack: null,
      screenTrack: null,
      cameraStream: null,
      screenStream: null,
      micOn: false,
      camOn: false,
    });
  }
}
