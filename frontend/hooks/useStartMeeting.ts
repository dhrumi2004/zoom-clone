"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { saveJoinIntent } from "@/lib/joinIntent";
import { prefs } from "@/lib/storage";
import type { User } from "@/lib/types";
import { refreshMeetingLists } from "./useMeetings";

/** "New meeting" and "Start": save host choices, then open the meeting room. */
export function useStartMeeting(user: User | undefined) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);

  const enterAsHost = (code: string) => {
    saveJoinIntent(code, {
      displayName: user?.name ?? "Host",
      asHost: true,
      audioOn: true,
      videoOn: prefs.startWithVideo(),
    });
    router.push(`/meeting/${code}`);
  };

  const startInstant = async () => {
    setCreating(true);
    try {
      const meeting = await api.createInstant();
      refreshMeetingLists();
      enterAsHost(meeting.meeting_code);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't start a meeting.", "error");
      setCreating(false);
    }
  };

  return { startInstant, enterAsHost, creating };
}
