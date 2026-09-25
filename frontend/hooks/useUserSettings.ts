"use client";

import useSWR from "swr";
import { api, keys } from "@/lib/api";

/** Personal defaults from Settings (meeting duration, waiting room, start with video...). */
export function useUserSettings() {
  return useSWR(keys.settings, api.getSettings);
}
