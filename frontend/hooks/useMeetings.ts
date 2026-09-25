"use client";

import useSWR, { mutate } from "swr";
import { api, keys } from "@/lib/api";

export function useUpcomingMeetings() {
  return useSWR(keys.upcoming, api.getUpcoming, { refreshInterval: 30_000 });
}

export function useRecentMeetings() {
  return useSWR(keys.recent, api.getRecent);
}

/** Re-fetch both dashboard lists after creating, editing, deleting or ending a meeting. */
export function refreshMeetingLists() {
  return Promise.all([mutate(keys.upcoming), mutate(keys.recent)]);
}
