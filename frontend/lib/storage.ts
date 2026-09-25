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

/** Preferences remembered across visits, like Zoom's "Remember my name" and "Start with video". */
export const prefs = {
  rememberedName: () => local.get("zoom:name"),
  setRememberedName: (name: string | null) => (name ? local.set("zoom:name", name) : local.remove("zoom:name")),
  startWithVideo: () => local.get("zoom:startWithVideo") !== "0",
  setStartWithVideo: (on: boolean) => local.set("zoom:startWithVideo", on ? "1" : "0"),
};
