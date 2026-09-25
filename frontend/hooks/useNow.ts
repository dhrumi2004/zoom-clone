"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
};
// Snapshot = current minute, so components re-render once per minute, not every second.
const getSnapshot = () => Math.floor(Date.now() / 60_000);
const getServerSnapshot = () => null;

/** Current time (minute precision), or null during server render to avoid hydration mismatches. */
export function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return minute === null ? null : new Date(minute * 60_000);
}
