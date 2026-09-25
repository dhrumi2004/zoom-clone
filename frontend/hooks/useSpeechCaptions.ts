"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any -- the Web Speech API has no TypeScript types yet */

/** Chrome/Edge/Safari speech recognition (Firefox doesn't support it). */
export function speechRecognitionSupported(): boolean {
  return typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

/**
 * Live captions for your own voice: while `active`, the browser transcribes the microphone and
 * `onText` receives partial ("interim") and final text, which the meeting shares with everyone.
 */
export function useSpeechCaptions(active: boolean, onText: (text: string, final: boolean) => void) {
  const [ownText, setOwnText] = useState("");
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });

  useEffect(() => {
    if (!active || !speechRecognitionSupported()) return;
    const Recognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    let stopped = false;
    let lastSent = 0;

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const text: string = result[0].transcript.trim();
      const final: boolean = result.isFinal;
      setOwnText(text);
      // Share final lines always, partial ones at most every 600 ms
      if (final || Date.now() - lastSent > 600) {
        lastSent = Date.now();
        onTextRef.current(text, final);
      }
    };
    // The browser stops listening after silence; keep it going while captions are on.
    recognition.onend = () => !stopped && setTimeout(() => !stopped && recognition.start(), 300);
    recognition.onerror = () => {};
    recognition.start();
    return () => {
      stopped = true;
      recognition.onend = null;
      recognition.stop();
      setOwnText("");
    };
  }, [active]);

  return ownText;
}
