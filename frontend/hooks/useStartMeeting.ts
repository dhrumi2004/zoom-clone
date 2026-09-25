"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { saveJoinIntent } from "@/lib/joinIntent";
import { prefs } from "@/lib/storage";
import type { Meeting, User } from "@/lib/types";
import { refreshMeetingLists } from "./useMeetings";
import { useUserSettings } from "./useUserSettings";

/** "New meeting" and "Start": save host choices (from Settings), then open the meeting room. */
export function useStartMeeting(user: User | undefined) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const { data: settings } = useUserSettings();

  const enterAsHost = async (code: string) => {
    // Clicked before the profile finished loading: fetch the name now instead of joining as "Host"
    const name = user?.name ?? (await api.getMe().catch(() => null))?.name ?? "Host";
    saveJoinIntent(code, {
      displayName: name,
      asHost: true,
      // Settings > Meetings: "Start meetings with my video on" / "Mute my microphone when joining"
      audioOn: !(settings?.mute_on_join ?? false),
      videoOn: settings?.start_with_video ?? true,
    });
    router.push(`/meeting/${code}`);
  };

  /** `beforeEnter` runs after the meeting exists, e.g. to post the invite link in a chat. */
  const startInstant = async (beforeEnter?: (meeting: Meeting) => Promise<void>) => {
    setCreating(true);
    try {
      const meeting = await api.createInstant({ usePmi: prefs.usePmi() });
      await beforeEnter?.(meeting);
      refreshMeetingLists();
      await enterAsHost(meeting.meeting_code);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't start a meeting.", "error");
      setCreating(false);
    }
  };

  return { startInstant, enterAsHost, creating };
}
