/** All HTTP calls to the FastAPI backend live here, so components never build URLs themselves. */
import { clearToken, getToken, loginUrl } from "./auth";
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
import type {
  Badges,
  Channel,
  ChannelMessage,
  Contact,
  Doc,
  DocSummary,
  Email,
  MailFolder,
  MarketplaceApp,
  Profile,
  ProfileUpdate,
  UserSettings,
  Whiteboard,
  WhiteboardSummary,
} from "./workspaceTypes";

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
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "network_error", "Can't reach the server. It may be waking up; please try again in a moment.");
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  // Signed out or session expired: go to the sign-in page, then come back here afterwards.
  if (res.status === 401 && body?.code === "not_authenticated") {
    clearToken();
    const onAuthPage = ["/login", "/signup"].some((p) => window.location.pathname.startsWith(p));
    if (!onAuthPage) window.location.assign(loginUrl(!!token));
  }
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
const patch = <T>(path: string, data: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(data) });
const del = <T = void>(path: string) => request<T>(path, { method: "DELETE" });

export interface AuthResult {
  token: string;
  user: User;
}

export const api = {
  signup: (name: string, email: string, password: string) =>
    post<AuthResult>("/api/auth/signup", { name, email, password }),
  login: (email: string, password: string) => post<AuthResult>("/api/auth/login", { email, password }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  getMe: () => request<User>("/api/users/me"),

  getUpcoming: () => request<Meeting[]>("/api/meetings/upcoming"),
  getRecent: () => request<Meeting[]>("/api/meetings/recent"),

  createInstant: (options: { title?: string; usePmi?: boolean } = {}) =>
    post<Meeting>("/api/meetings/instant", { title: options.title, use_pmi: !!options.usePmi }),
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
  getCalendar: (start: Date, end: Date) =>
    request<Meeting[]>(
      `/api/meetings/calendar?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
    ),

  // Profile & settings
  updateMe: (data: ProfileUpdate) => patch<User>("/api/users/me", data),
  getProfile: () => request<Profile>("/api/users/me/profile"),
  getSettings: () => request<UserSettings>("/api/users/me/settings"),
  updateSettings: (data: Partial<UserSettings>) => patch<UserSettings>("/api/users/me/settings", data),
  getBadges: () => request<Badges>("/api/users/me/badges"),

  // Contacts
  getContacts: () => request<Contact[]>("/api/contacts"),
  setFavorite: (userId: number, isFavorite: boolean) =>
    patch<Contact>(`/api/contacts/${userId}`, { is_favorite: isFavorite }),

  // Team Chat
  getChannels: () => request<Channel[]>("/api/chat/channels"),
  createChannel: (name: string, memberIds: number[], description?: string) =>
    post<Channel>("/api/chat/channels", { name, member_ids: memberIds, description: description || null }),
  openDirect: (userId: number) => post<Channel>("/api/chat/direct", { user_id: userId }),
  getChannelMessages: (id: number) => request<ChannelMessage[]>(`/api/chat/channels/${id}/messages`),
  sendChannelMessage: (id: number, content: string) =>
    post<ChannelMessage>(`/api/chat/channels/${id}/messages`, { content }),

  // Mail
  getMail: (folder: MailFolder, q?: string) =>
    request<{ items: Email[]; unread_inbox: number }>(
      `/api/mail?folder=${folder}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
    ),
  sendMail: (to: string[], subject: string, body: string) => post<Email>("/api/mail", { to, subject, body }),
  updateMail: (id: number, data: { is_read?: boolean; is_starred?: boolean; action?: "trash" | "restore" }) =>
    patch<Email>(`/api/mail/${id}`, data),
  deleteMail: (id: number) => del(`/api/mail/${id}`),

  // Docs
  getDocs: () => request<DocSummary[]>("/api/docs"),
  createDoc: (title?: string) => post<Doc>("/api/docs", title ? { title } : {}),
  getDoc: (id: number) => request<Doc>(`/api/docs/${id}`),
  updateDoc: (id: number, data: { title?: string; content?: string }) => patch<Doc>(`/api/docs/${id}`, data),
  deleteDoc: (id: number) => del(`/api/docs/${id}`),

  // Whiteboards
  getWhiteboards: () => request<WhiteboardSummary[]>("/api/whiteboards"),
  createWhiteboard: (title?: string) => post<Whiteboard>("/api/whiteboards", title ? { title } : {}),
  getWhiteboard: (id: number) => request<Whiteboard>(`/api/whiteboards/${id}`),
  updateWhiteboard: (id: number, data: { title?: string; data?: string }) =>
    patch<Whiteboard>(`/api/whiteboards/${id}`, data),
  deleteWhiteboard: (id: number) => del(`/api/whiteboards/${id}`),

  // Apps
  getApps: () => request<MarketplaceApp[]>("/api/apps"),
  installApp: (key: string) => request<MarketplaceApp>(`/api/apps/${key}`, { method: "PUT" }),
  uninstallApp: (key: string) => del<MarketplaceApp>(`/api/apps/${key}`),
};

/** SWR cache keys, shared so a mutation can refresh the right list. */
export const keys = {
  me: "me",
  upcoming: "meetings/upcoming",
  recent: "meetings/recent",
  badges: "badges",
  settings: "settings",
  profile: "profile",
  contacts: "contacts",
  channels: "channels",
  docs: "docs",
  whiteboards: "whiteboards",
  apps: "apps",
} as const;
