"use client";

import useSWR from "swr";
import { api, keys } from "@/lib/api";

/** The signed-in (default) user. Cached by SWR, so every component shares one request. */
export function useCurrentUser() {
  const { data, error, isLoading } = useSWR(keys.me, api.getMe);
  return { user: data, error, isLoading };
}
