/** Shapes of the WebSocket protocol (see backend/app/routers/ws.py). */
import type { MeetingSettings, Participant } from "@/lib/types";

export interface RoomParticipant extends Participant {
  hand_raised: boolean;
  is_sharing: boolean;
  is_cohost: boolean;
}

export interface ChatMessage {
  id: number;
  participant_id: number;
  sender_name: string;
  /** Set for private messages */
  recipient_id: number | null;
  recipient_name: string | null;
  content: string;
  sent_at: string;
}

export interface SecurityState {
  locked: boolean;
  settings: MeetingSettings;
}

export interface PollOption {
  id: number;
  text: string;
  /** Only present when you may see results (host/co-host, or after results are shared) */
  votes?: number;
  voters?: string[];
}

export interface Poll {
  id: number;
  question: string;
  anonymous: boolean;
  status: "open" | "ended";
  results_shared: boolean;
  options: PollOption[];
  total_votes: number | null;
  my_vote: number | null;
}

export interface BreakoutRoom {
  id: number;
  name: string;
  participants: { id: number; display_name: string }[];
}

export interface BreakoutState {
  open: boolean;
  rooms: BreakoutRoom[];
}

/** Relayed as-is between browsers by the server. */
export type SignalData =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit };

export interface WaitingPerson {
  id: number;
  display_name: string;
}

export type ServerMessage =
  | {
      type: "room_state";
      self_id: number;
      participants: RoomParticipant[];
      messages: ChatMessage[];
      screen_sharer_id: number | null;
      /** Only filled for hosts and co-hosts */
      waiting: WaitingPerson[];
      /** 0 = main room, 1..n = breakout rooms */
      room_id: number;
      room_name: string | null;
      spotlight_id: number | null;
      recording: boolean;
      polls: Poll[];
      security: SecurityState;
      breakout: BreakoutState;
    }
  | { type: "waiting_room"; title: string }
  | { type: "waiting_room_updated"; waiting: WaitingPerson[] }
  | { type: "participant_joined"; participant: RoomParticipant }
  | { type: "participant_left"; participant_id: number }
  | { type: "participant_updated"; participant: RoomParticipant }
  | { type: "signal"; from_id: number; data: SignalData }
  | { type: "chat"; message: ChatMessage }
  | { type: "reaction"; participant_id: number; emoji: string }
  | { type: "screen_share"; participant_id: number; active: boolean }
  | { type: "force_mute" }
  | { type: "unmute_request" }
  | { type: "removed" }
  | { type: "meeting_ended" }
  | { type: "error"; code: string; detail: string }
  | { type: "force_video_off" }
  | { type: "video_request" }
  | { type: "spotlight"; participant_id: number | null }
  | { type: "cohost"; value: boolean }
  | ({ type: "security" } & SecurityState)
  | { type: "recording"; active: boolean }
  | { type: "caption"; participant_id: number; text: string; final: boolean }
  | { type: "poll"; poll: Poll }
  | ({ type: "breakout_state" } & BreakoutState);

export const REACTIONS = ["👏", "👍", "❤️", "😂", "😮", "🎉"] as const;

/** Close codes set by the server. */
export const CLOSE_CODES = { replaced: 4000, invalid: 4001, removed: 4003, ended: 4004 } as const;
