/**
 * The signed-in session on this browser. The backend gives a random token at sign-in; we keep it in
 * localStorage and send it as "Authorization: Bearer <token>" (and in the meeting WebSocket URL).
 * (A cookie would be blocked as third-party between the Vercel site and the Render API.)
 */
import { useSyncExternalStore } from "react";
import { local } from "./storage";

const KEY = "zoom:token";
const EVENT = "zoom:auth";

export function getToken(): string | null {
  return local.get(KEY);
}

export function setToken(token: string) {
  local.set(KEY, token);
  window.dispatchEvent(new Event(EVENT));
}

export function clearToken() {
  local.remove(KEY);
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // signed in/out in another tab
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

/** undefined while rendering on the server, null when signed out, otherwise the token. */
export function useAuthToken(): string | null | undefined {
  return useSyncExternalStore(subscribe, getToken, () => undefined);
}

/** Only allow redirects back into this site after signing in (never to another domain). */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") && !next.startsWith("/signup")
    ? next
    : "/";
}

export function loginUrl(expired = false): string {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  return `/login?next=${next}${expired ? "&expired=1" : ""}`;
}
