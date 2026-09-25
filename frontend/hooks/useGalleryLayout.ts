"use client";

import { RefObject, useEffect, useState } from "react";

const ASPECT = 16 / 9;

/**
 * Picks the column count that makes 16:9 tiles as large as possible inside the container,
 * like Zoom's gallery view (1 = full, 2 = side by side, 4 = 2x2, ...).
 */
export function useGalleryLayout(ref: RefObject<HTMLElement | null>, count: number, gap = 8) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  let best = { cols: 1, tileWidth: 0, tileHeight: 0 };
  for (let cols = 1; cols <= Math.max(1, count); cols++) {
    const rows = Math.ceil(count / cols);
    let w = (size.width - gap * (cols - 1)) / cols;
    let h = w / ASPECT;
    if (h * rows + gap * (rows - 1) > size.height) {
      h = (size.height - gap * (rows - 1)) / rows;
      w = h * ASPECT;
    }
    if (w * h > best.tileWidth * best.tileHeight) best = { cols, tileWidth: Math.floor(w), tileHeight: Math.floor(h) };
  }
  return best;
}
