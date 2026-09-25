"use client";

import { RefObject, useEffect } from "react";

/** Calls `onOutside` on a click outside `ref` or on Escape, while `active` is true (dropdowns, popovers). */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOutside();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, onOutside, active]);
}
