import { formatLongDate, formatMeetingCode, formatTime } from "./format";
import type { Meeting } from "./types";

/** The text Zoom copies with "Copy invitation". */
export function buildInvitation(meeting: Meeting): string {
  const lines = [`${meeting.host.name} is inviting you to a scheduled Zoom meeting.`, "", `Topic: ${meeting.title}`];
  if (meeting.scheduled_start) {
    lines.push(`Time: ${formatLongDate(meeting.scheduled_start)}, ${formatTime(meeting.scheduled_start)}`);
    if (meeting.recurrence && meeting.recurrence !== "none") {
      lines.push(`Every ${{ daily: "day", weekly: "week", monthly: "month" }[meeting.recurrence]}${meeting.recurrence_end ? ` until ${meeting.recurrence_end}` : ""}`);
    }
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

/** Opens Zoom Mail with the invitation pre-filled ("Email invitation"). */
export function emailInvitationUrl(meeting: Meeting): string {
  const params = new URLSearchParams({ compose: "", subject: `Invitation: ${meeting.title}`, body: buildInvitation(meeting) });
  return `/mail?${params.toString()}`;
}
