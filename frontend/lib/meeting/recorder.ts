/**
 * "Record to this computer": records the meeting tab (what you see) plus your microphone,
 * then downloads a .webm file when you stop, like Zoom's local recording.
 */
const MIME_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

export function recordingSupported(): boolean {
  return typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

export class MeetingRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private display: MediaStream | null = null;
  private audio: AudioContext | null = null;
  onStopped: (() => void) | null = null;

  /** Must be called from a click. Returns false if the user cancelled the "share this tab" prompt. */
  async start(micTrack: MediaStreamTrack | null): Promise<boolean> {
    try {
      this.display = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser", frameRate: { ideal: 24 } },
        audio: true, // the tab's sound = everyone else's voices
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      } as DisplayMediaStreamOptions);
    } catch {
      return false;
    }

    // Mix the tab's audio with your own microphone
    this.audio = new AudioContext();
    const mix = this.audio.createMediaStreamDestination();
    for (const track of [...this.display.getAudioTracks(), ...(micTrack ? [micTrack] : [])]) {
      this.audio.createMediaStreamSource(new MediaStream([track])).connect(mix);
    }
    const stream = new MediaStream([...this.display.getVideoTracks(), ...mix.stream.getAudioTracks()]);

    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    this.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start(1000);
    // Browser's own "Stop sharing" button ends the recording too
    this.display.getVideoTracks()[0].onended = () => this.stop();
    return true;
  }

  get active(): boolean {
    return this.recorder?.state === "recording";
  }

  /** Stops and downloads the file. */
  stop(fileName = "Zoom Recording") {
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive") return;
    recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName} ${new Date().toLocaleString().replace(/[/:]/g, "-")}.webm`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      this.onStopped?.();
    };
    recorder.stop();
    this.display?.getTracks().forEach((t) => t.stop());
    void this.audio?.close();
    this.recorder = null;
  }
}
