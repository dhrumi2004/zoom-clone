/** Types mirroring backend/app/schemas.py. Dates arrive as ISO strings in UTC ("...Z"). */

export type MeetingType = "instant" | "scheduled";
export type MeetingStatus = "scheduled" | "live" | "ended";
export type ParticipantRole = "host" | "participant";

export interface User {
  id: number;
  name: string;
  email: string;
  avatar_color: string;
  personal_meeting_id: string;
}

export interface Host {
  id: number;
  name: string;
  avatar_color: string;
}

export interface MeetingSettings {
  waiting_room: boolean;
  mute_on_entry: boolean;
  host_video_on: boolean;
  participant_video_on: boolean;
  allow_chat: boolean;
  allow_screen_share: boolean;
}

/** What anyone with the Meeting ID can see. */
export interface MeetingPublic {
  meeting_code: string;
  title: string;
  type: MeetingType;
  status: MeetingStatus;
  host: Host;
  scheduled_start: string | null;
  duration_min: number | null;
  started_at: string | null;
  settings: MeetingSettings;
}

/** Owner view: adds passcode and invite link. */
export interface Meeting extends MeetingPublic {
  id: number;
  description: string | null;
  passcode: string;
  ended_at: string | null;
  created_at: string;
  participant_count: number;
  invite_link: string;
}

export interface Participant {
  id: number;
  user_id: number | null;
  display_name: string;
  role: ParticipantRole;
  joined_at: string;
  is_muted: boolean;
  is_video_off: boolean;
}

export interface JoinResponse {
  participant: Participant;
  meeting: MeetingPublic;
}

export interface ScheduleMeetingInput {
  title: string;
  description?: string | null;
  scheduled_start: string; // ISO with timezone
  duration_min: number;
  passcode?: string | null;
  settings?: Partial<MeetingSettings>;
}

export interface JoinMeetingInput {
  display_name: string;
  passcode?: string | null;
  as_host?: boolean;
}
