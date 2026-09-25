"use client";

import { useEffect, useRef } from "react";

/** Plays one participant's microphone. Kept separate from video so audio continues with the camera off. */
export function RemoteAudio({ stream, speakerId }: { stream: MediaStream; speakerId?: string }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.srcObject = stream;
    // Autoplay is allowed because the user clicked "Join"; retry once if the browser still blocks it.
    audio.play().catch(() => document.addEventListener("click", () => audio.play().catch(() => {}), { once: true }));
  }, [stream]);

  // Speaker chosen in the toolbar's audio menu (Chrome/Edge support choosing an output device)
  useEffect(() => {
    const audio = ref.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (audio?.setSinkId && speakerId) audio.setSinkId(speakerId).catch(() => {});
  }, [speakerId]);

  return <audio ref={ref} autoPlay />;
}
