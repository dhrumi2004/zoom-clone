"use client";

import { useEffect, useRef } from "react";

/** Plays one participant's microphone. Kept separate from video so audio continues with the camera off. */
export function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.srcObject = stream;
    // Autoplay is allowed because the user clicked "Join"; retry once if the browser still blocks it.
    audio.play().catch(() => document.addEventListener("click", () => audio.play().catch(() => {}), { once: true }));
  }, [stream]);

  return <audio ref={ref} autoPlay />;
}
