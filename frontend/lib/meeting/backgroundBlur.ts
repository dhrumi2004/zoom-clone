/**
 * Zoom's "Blur my background": a person-segmentation model (MediaPipe selfie segmenter) finds you in each
 * camera frame; the frame is drawn blurred, then the sharp "you" pixels are drawn on top. The result is a
 * new video track (canvas.captureStream) that replaces the camera track sent to everyone.
 *
 * The library and model (~250 KB) load on first use only.
 */
import type { ImageSegmenter } from "@mediapipe/tasks-vision";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
const BLUR_PX = 14;
const FPS = 24;

let segmenterPromise: Promise<ImageSegmenter> | null = null;

function loadSegmenter(): Promise<ImageSegmenter> {
  segmenterPromise ??= (async () => {
    const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    return ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });
  })();
  // Allow a retry later if loading failed (e.g. offline)
  segmenterPromise.catch(() => (segmenterPromise = null));
  return segmenterPromise;
}

export class BlurProcessor {
  private video = document.createElement("video");
  private canvas = document.createElement("canvas");
  private maskCanvas = document.createElement("canvas");
  private personCanvas = document.createElement("canvas");
  private timer: ReturnType<typeof setInterval> | null = null;
  private output: MediaStreamTrack | null = null;

  private constructor(private segmenter: ImageSegmenter) {}

  static async create(): Promise<BlurProcessor> {
    return new BlurProcessor(await loadSegmenter());
  }

  /** Start blurring `input`; returns the processed track to send instead. */
  async start(input: MediaStreamTrack): Promise<MediaStreamTrack> {
    const { width = 1280, height = 720 } = input.getSettings();
    for (const c of [this.canvas, this.personCanvas]) {
      c.width = width;
      c.height = height;
    }
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = new MediaStream([input]);
    await this.video.play();

    const ctx = this.canvas.getContext("2d")!;
    const personCtx = this.personCanvas.getContext("2d")!;
    const maskCtx = this.maskCanvas.getContext("2d")!;

    // A timer (not requestAnimationFrame) keeps processing when the tab is in the background.
    this.timer = setInterval(() => {
      if (this.video.readyState < 2) return;
      const result = this.segmenter.segmentForVideo(this.video, performance.now());
      const mask = result.confidenceMasks?.[0];
      if (!mask) return;

      // Person probability -> alpha channel
      const values = mask.getAsFloat32Array();
      if (this.maskCanvas.width !== mask.width) {
        this.maskCanvas.width = mask.width;
        this.maskCanvas.height = mask.height;
      }
      const image = maskCtx.createImageData(mask.width, mask.height);
      for (let i = 0; i < values.length; i++) image.data[i * 4 + 3] = values[i] * 255;
      maskCtx.putImageData(image, 0, 0);
      result.close();

      // Sharp person only
      personCtx.globalCompositeOperation = "copy";
      personCtx.filter = "blur(2px)"; // soften the mask edge
      personCtx.drawImage(this.maskCanvas, 0, 0, width, height);
      personCtx.filter = "none";
      personCtx.globalCompositeOperation = "source-in";
      personCtx.drawImage(this.video, 0, 0, width, height);

      // Blurred background, then the person on top
      ctx.filter = `blur(${BLUR_PX}px)`;
      ctx.drawImage(this.video, 0, 0, width, height);
      ctx.filter = "none";
      ctx.drawImage(this.personCanvas, 0, 0);
    }, 1000 / FPS);

    this.output = this.canvas.captureStream(FPS).getVideoTracks()[0];
    return this.output;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.output?.stop();
    this.video.srcObject = null;
  }
}
