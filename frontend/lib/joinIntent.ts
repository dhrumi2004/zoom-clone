/**
 * What the user chose before entering a meeting (name, passcode, mic/camera, host start).
 * Saved per tab in sessionStorage so the meeting URL stays clean (/meeting/1234567890)
 * and a page refresh still remembers the choice.
 */
import { session } from "./storage";

export interface JoinIntent {
  displayName: string;
  passcode?: string;
  asHost: boolean;
  audioOn: boolean;
  videoOn: boolean;
  /** Share screen tile: start sharing right after joining */
  shareOnJoin?: boolean;
}

const key = (code: string) => `zoom:join:${code}`;
/** Fired on window after saving, so an open meeting page can react (see hooks/useJoinIntent). */
export const JOIN_INTENT_EVENT = "zoom:join-intent";

export function saveJoinIntent(code: string, intent: JoinIntent) {
  session.set(key(code), JSON.stringify(intent));
  window.dispatchEvent(new Event(JOIN_INTENT_EVENT));
}

/** Raw JSON string (stable between reads, which useSyncExternalStore needs). */
export function readJoinIntentRaw(code: string): string | null {
  return session.get(key(code));
}

export function parseJoinIntent(raw: string | null): JoinIntent | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JoinIntent;
  } catch {
    return null;
  }
}
