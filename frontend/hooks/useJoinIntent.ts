"use client";

import { useMemo, useSyncExternalStore } from "react";
import { JOIN_INTENT_EVENT, parseJoinIntent, readJoinIntentRaw } from "@/lib/joinIntent";

const subscribe = (onChange: () => void) => {
  window.addEventListener(JOIN_INTENT_EVENT, onChange);
  return () => window.removeEventListener(JOIN_INTENT_EVENT, onChange);
};

/**
 * The join choices saved for this meeting in this tab.
 * `undefined` during server render (unknown yet), `null` when nothing was saved.
 */
export function useJoinIntent(code: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => readJoinIntentRaw(code),
    () => undefined,
  );
  return useMemo(() => (raw === undefined ? undefined : parseJoinIntent(raw)), [raw]);
}
