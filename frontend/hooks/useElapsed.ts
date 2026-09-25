"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
};
const getSecond = () => Math.floor(Date.now() / 1000);

/** "12:34" or "1:02:03" since `startIso` (Zoom's meeting timer), updated every second. */
export function useElapsed(startIso: string | null): string | null {
  const now = useSyncExternalStore(subscribe, getSecond, () => null);
  if (!startIso || now === null) return null;
  const total = Math.max(0, now - Math.floor(new Date(startIso).getTime() / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${String(m).padStart(2, "0")}:${sec}`;
}
