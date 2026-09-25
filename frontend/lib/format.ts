/** Display helpers. The backend sends UTC; these render in the viewer's local timezone. */

/** "1234567890" -> "123 456 7890", "12345678901" -> "123 4567 8901" (Zoom's grouping). */
export function formatMeetingCode(code: string): string {
  const digits = code.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 11) return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  return digits;
}

/** "3:30 PM" */
export function formatTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** "Thursday, September 25" */
export function formatLongDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

/** "Today", "Tomorrow", or "Mon, Sep 29" */
export function formatRelativeDay(iso: string | Date): string {
  const date = new Date(iso);
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(date) - startOf(today)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

/** "3:30 PM - 4:00 PM" */
export function formatTimeRange(startIso: string, durationMin: number): string {
  const end = new Date(new Date(startIso).getTime() + durationMin * 60_000);
  return `${formatTime(startIso)} - ${formatTime(end)}`;
}

/** 45 -> "45 min", 90 -> "1 hr 30 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** "Dhrumi Upadhyay" -> "DU" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const AVATAR_COLORS = ["#0E72ED", "#8B5CF6", "#F97316", "#10B981", "#EF4444", "#EAB308", "#EC4899", "#14B8A6"];

/** Stable color for someone without an account (guests), based on their name. */
export function colorForName(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
