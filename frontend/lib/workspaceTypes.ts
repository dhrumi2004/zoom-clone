/** Types for Team Chat, Mail, Contacts, Docs, Whiteboards, Apps and Settings (backend/app/schemas/workspace.py). */

export interface Profile {
  job_title: string | null;
  department: string | null;
  phone: string | null;
  location: string | null;
}

export interface ProfileUpdate extends Partial<Profile> {
  name?: string;
  avatar_color?: string;
}

export interface UserSettings {
  start_with_video: boolean;
  mute_on_join: boolean;
  default_duration_min: number;
  default_waiting_room: boolean;
  default_mute_on_entry: boolean;
}

export interface Badges {
  chat_unread: number;
  mail_unread: number;
}

export interface Contact extends Profile {
  user_id: number;
  name: string;
  email: string;
  avatar_color: string;
  personal_meeting_id: string;
  is_favorite: boolean;
}

export interface Member {
  id: number;
  name: string;
  avatar_color: string;
}

export interface Channel {
  id: number;
  type: "channel" | "direct";
  name: string;
  description: string | null;
  members: Member[];
  unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
}

export interface ChannelMessage {
  id: number;
  channel_id: number;
  sender: Member | null;
  content: string;
  sent_at: string;
}

export type MailFolder = "inbox" | "sent" | "starred" | "trash";

export interface Email {
  id: number;
  folder: "inbox" | "sent" | "trash";
  from_name: string;
  from_email: string;
  to_emails: string;
  subject: string;
  body: string;
  is_read: boolean;
  is_starred: boolean;
  sent_at: string;
}

export interface DocSummary {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}
export interface Doc extends DocSummary {
  content: string;
}

export type WhiteboardSummary = DocSummary;
export interface Whiteboard extends DocSummary {
  data: string;
}

export interface Stroke {
  tool: "pen" | "highlighter" | "eraser";
  color: string;
  size: number;
  points: [number, number][];
}

export interface MarketplaceApp {
  key: string;
  name: string;
  developer: string;
  category: string;
  description: string;
  color: string;
  installed: boolean;
}
