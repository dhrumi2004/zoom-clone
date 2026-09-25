"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "saved" | "saving" | "unsaved" | "error";

/**
 * Debounced autosave for Docs and Whiteboards: call `schedule(value)` on every change;
 * `save` runs `delay` ms after the last change, and pending changes are flushed on unmount.
 */
export function useAutosave<T>(save: (value: T) => Promise<unknown>, delay = 800) {
  const [state, setState] = useState<SaveState>("saved");
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  });

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setState("saving");
    try {
      await saveRef.current(next.value);
      setState(pending.current ? "unsaved" : "saved");
    } catch {
      setState("error");
    }
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      setState("unsaved");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush, delay],
  );

  // Save anything left when leaving the page.
  useEffect(() => () => void flush(), [flush]);

  return { state, schedule, flush };
}

export function SaveStatus({ state }: { state: SaveState }) {
  const text = { saved: "All changes saved", saving: "Saving…", unsaved: "Unsaved changes", error: "Couldn't save. Retrying on next change" }[state];
  return <span className={state === "error" ? "text-xs text-danger" : "text-xs text-ink-muted"}>{text}</span>;
}
