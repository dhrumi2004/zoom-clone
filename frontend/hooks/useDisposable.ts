"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Creates an object once per component (a LocalMedia, a MeetingClient) and disposes it when the
 * component really unmounts. React's development Strict Mode mounts, unmounts and re-mounts every
 * component; the deferred dispose is cancelled by that re-mount, so the camera or socket survives.
 */
export function useDisposable<T>(create: () => T, dispose: (value: T) => void): T {
  const [value] = useState(create);
  const disposeRef = useRef(dispose);
  const pending = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    disposeRef.current = dispose;
  });

  useEffect(() => {
    clearTimeout(pending.current);
    return () => {
      pending.current = setTimeout(() => disposeRef.current(value), 0);
    };
  }, [value]);

  return value;
}
