"use client";

import clsx from "clsx";
import { useEffect, useRef } from "react";

/** <video> bound to a MediaStream. Always muted: sound plays through <RemoteAudio>. */
export function MediaVideo({
  stream,
  mirror,
  fit = "cover",
  className,
}: {
  stream: MediaStream | null;
  mirror?: boolean;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (video && video.srcObject !== stream) video.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={clsx(
        "size-full",
        fit === "cover" ? "object-cover" : "object-contain",
        mirror && "-scale-x-100", // your own camera is shown mirrored, like Zoom
        className,
      )}
    />
  );
}
