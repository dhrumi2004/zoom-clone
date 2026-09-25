/** Shapes of the WebSocket protocol (see backend/app/routers/ws.py). */
import type { Participant } from "@/lib/types";

export interface RoomParticipant extends Participant {
  hand_raised: boolean;
  is_sharing: boolean;
}

export interface ChatMessage {
  id: number;
  participant_id: number;
  sender_name: string;
  content: string;
  sent_at: string;
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
      /** Only filled for hosts */
      waiting: WaitingPerson[];
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
  | { type: "error"; code: string; detail: string };

export const REACTIONS = ["👏", "👍", "❤️", "😂", "😮", "🎉"] as const;

/** Close codes set by the server. */
export const CLOSE_CODES = { replaced: 4000, invalid: 4001, removed: 4003, ended: 4004 } as const;
