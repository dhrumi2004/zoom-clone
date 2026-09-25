"use client";

import useSWR from "swr";
import { api, keys } from "@/lib/api";

/** Unread counts for the Team Chat and Mail tabs (refreshed every 15 s). */
export function useBadges() {
  return useSWR(keys.badges, api.getBadges, { refreshInterval: 15_000 }).data;
}
