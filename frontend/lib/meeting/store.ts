import { useSyncExternalStore } from "react";

/**
 * Tiny observable state container. The meeting engine (LocalMedia, MeetingClient) is plain TypeScript,
 * not React; components read it with useStore() and re-render when it changes.
 */
export class Store<S extends object> {
  private listeners = new Set<() => void>();

  constructor(protected state: S) {}

  getSnapshot = (): S => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Always creates a new state object, so React sees the change. */
  protected setState(patch: Partial<S> | ((state: S) => Partial<S>)) {
    const next = typeof patch === "function" ? patch(this.state) : patch;
    this.state = { ...this.state, ...next };
    this.listeners.forEach((l) => l());
  }
}

export function useStore<S extends object>(store: Store<S>): S {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
