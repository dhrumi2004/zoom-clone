/** Date/time helpers for the Schedule form. Values are local time; converted to ISO (UTC) on submit. */

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" in local time, for <input type="date">. */
export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "HH:MM" in local time. */
export function toTimeValue(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Next half-hour slot, e.g. 10:07 -> 10:30 (Zoom's default start time). */
export function nextHalfHour(from = new Date()): Date {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return d;
}

/** Every 15 minutes of the day as {value: "HH:MM", label: "3:15 PM"}. */
export const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const d = new Date(2000, 0, 1, Math.floor(i / 4), (i % 4) * 15);
  return { value: toTimeValue(d), label: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) };
});

/** Local date + "HH:MM" -> ISO string with timezone info (UTC). */
export function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

/** "(GMT+05:30) Asia/Kolkata" for the viewer's timezone. */
export function timezoneLabel(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `(GMT${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}) ${zone}`;
}

export function randomPasscode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}
