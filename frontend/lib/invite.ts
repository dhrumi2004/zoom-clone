import { formatLongDate, formatMeetingCode, formatTime } from "./format";
import type { Meeting } from "./types";

/** The text Zoom copies with "Copy invitation". */
export function buildInvitation(meeting: Meeting): string {
  const lines = [`${meeting.host.name} is inviting you to a scheduled Zoom meeting.`, "", `Topic: ${meeting.title}`];
  if (meeting.scheduled_start) {
    lines.push(`Time: ${formatLongDate(meeting.scheduled_start)}, ${formatTime(meeting.scheduled_start)}`);
  }
  lines.push(
    "",
    "Join Zoom Meeting",
    meeting.invite_link,
    "",
    `Meeting ID: ${formatMeetingCode(meeting.meeting_code)}`,
    `Passcode: ${meeting.passcode}`,
  );
  return lines.join("\n");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
