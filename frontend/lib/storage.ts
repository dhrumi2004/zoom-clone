/** localStorage/sessionStorage wrappers that never throw (private mode, blocked storage, server render). */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return typeof window === "undefined" ? fallback : fn();
  } catch {
    return fallback;
  }
}

export const local = {
  get: (key: string) => safe(() => localStorage.getItem(key), null),
  set: (key: string, value: string) => safe(() => localStorage.setItem(key, value), undefined),
  remove: (key: string) => safe(() => localStorage.removeItem(key), undefined),
};

export const session = {
  get: (key: string) => safe(() => sessionStorage.getItem(key), null),
  set: (key: string, value: string) => safe(() => sessionStorage.setItem(key, value), undefined),
};

/**
 * Per-browser preferences: Zoom's "Remember my name" and the chosen camera/microphone
 * (device ids differ between computers, so they don't belong in the database).
 */
export const prefs = {
  rememberedName: () => local.get("zoom:name"),
  setRememberedName: (name: string | null) => (name ? local.set("zoom:name", name) : local.remove("zoom:name")),
  cameraId: () => local.get("zoom:cameraId"),
  setCameraId: (id: string) => local.set("zoom:cameraId", id),
  micId: () => local.get("zoom:micId"),
  setMicId: (id: string) => local.set("zoom:micId", id),
  speakerId: () => local.get("zoom:speakerId"),
  setSpeakerId: (id: string) => local.set("zoom:speakerId", id),
  usePmi: () => local.get("zoom:usePmi") === "1",
  setUsePmi: (on: boolean) => local.set("zoom:usePmi", on ? "1" : "0"),
  blur: () => local.get("zoom:blur") === "1",
  setBlur: (on: boolean) => local.set("zoom:blur", on ? "1" : "0"),
};
