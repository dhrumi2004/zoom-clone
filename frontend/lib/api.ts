/** All HTTP calls to the FastAPI backend live here, so components never build URLs themselves. */
import { API_URL } from "./config";
import type {
  JoinMeetingInput,
  JoinResponse,
  Meeting,
  MeetingPublic,
  Participant,
  ScheduleMeetingInput,
  User,
} from "./types";

/** Error with the backend's machine-readable `code` (e.g. "not_found", "passcode_required"). */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "network_error", "Can't reach the server. Is the backend running?");
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // AppError -> {code, detail: string}; FastAPI validation -> {detail: [{msg}]}
    const detail = Array.isArray(body?.detail)
      ? body.detail.map((d: { msg: string }) => d.msg.replace(/^Value error, /, "")).join(", ")
      : body?.detail;
    throw new ApiError(res.status, body?.code ?? "request_failed", detail ?? "Something went wrong.");
  }
  return body as T;
}

const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) });

export const api = {
  getMe: () => request<User>("/api/users/me"),

  getUpcoming: () => request<Meeting[]>("/api/meetings/upcoming"),
  getRecent: () => request<Meeting[]>("/api/meetings/recent"),

  createInstant: (title?: string) => post<Meeting>("/api/meetings/instant", { title }),
  schedule: (data: ScheduleMeetingInput) => post<Meeting>("/api/meetings", data),
  update: (code: string, data: Partial<ScheduleMeetingInput>) =>
    request<Meeting>(`/api/meetings/${code}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (code: string) => request<void>(`/api/meetings/${code}`, { method: "DELETE" }),

  getMeeting: (code: string) => request<MeetingPublic>(`/api/meetings/${encodeURIComponent(code)}`),
  getDetails: (code: string) => request<Meeting>(`/api/meetings/${code}/details`),

  /** Validates ID, "ended" and passcode without joining. */
  verify: (code: string, passcode?: string | null) =>
    post<MeetingPublic>(`/api/meetings/${encodeURIComponent(code)}/verify`, { passcode: passcode || null }),
  join: (code: string, data: JoinMeetingInput) => post<JoinResponse>(`/api/meetings/${code}/join`, data),
  leave: (code: string, participantId: number) =>
    post<MeetingPublic>(`/api/meetings/${code}/leave`, { participant_id: participantId }),
  end: (code: string) => post<Meeting>(`/api/meetings/${code}/end`),
  getParticipants: (code: string) =>
    request<{ participants: Participant[] }>(`/api/meetings/${code}/participants`),
};

/** SWR cache keys, shared so a mutation can refresh the right list. */
export const keys = {
  me: "me",
  upcoming: "meetings/upcoming",
  recent: "meetings/recent",
} as const;
