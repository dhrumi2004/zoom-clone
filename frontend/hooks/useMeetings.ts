"use client";

import useSWR, { mutate } from "swr";
import { api, keys } from "@/lib/api";

export function useUpcomingMeetings() {
  return useSWR(keys.upcoming, api.getUpcoming, { refreshInterval: 30_000 });
}

export function useRecentMeetings() {
  return useSWR(keys.recent, api.getRecent);
}

/** Re-fetch the dashboard lists and any open calendar week after creating, editing, deleting or ending a meeting. */
export function refreshMeetingLists() {
  return Promise.all([
    mutate(keys.upcoming),
    mutate(keys.recent),
    mutate((key) => Array.isArray(key) && key[0] === "calendar"),
  ]);
}
