# Zoom Clone – project context

SDE fullstack assignment: a Zoom web app clone. UI/UX must look like real Zoom. Graded on functionality, UI similarity, DB schema design, code quality/modularity, and the author's ability to explain the code.

## Working agreement
- The user builds one step per new chat by typing "Start Step N". Do only that step.
- Explain in very simple, beginner-friendly language.
- Tell the user if their prompt is wrong or wasteful.
- End every step with: what to run, how to check it works, and the exact next prompt to paste.
- Keep token usage low: don't re-read files you don't need; don't run long-lived servers yourself.

## Stack
- `backend/`: Python 3.9 (keep code 3.9-compatible: use `Optional[...]`, not `X | None`), FastAPI, SQLAlchemy 2.0, SQLite.
- `frontend/`: **Next.js 16** App Router + React 19 + TypeScript + **Tailwind v4** (theme lives in CSS `@theme`, there's no tailwind.config). Libraries: swr, lucide-react, clsx.
  - Next 16: `params`/`searchParams` are Promises (use `use(params)` in client pages or `PageProps<'/route'>`); `middleware` is now `proxy`; read `frontend/node_modules/next/dist/docs/` when unsure
- Real video: WebRTC mesh, with signaling over FastAPI WebSockets.
- Deploy: Vercel (frontend) + Render (backend). The DB auto-creates and seeds on startup.
- No auth: every request acts as the seeded default user (`config.DEFAULT_USER_EMAIL`).

## Backend layout
- `app/config.py`: env settings (DATABASE_URL, FRONTEND_URL, CORS_ORIGINS, default user)
- `app/database.py`: engine (SQLite FK pragma on), SessionLocal, Base, `get_db` dependency
- `app/models.py`: ORM schema
- `app/utils.py`: `utcnow`, code/passcode generators (no DB access)
- `app/services/codes.py`: `generate_unique_meeting_code(db)`
- `app/seed.py`: sample data; `python -m app.seed --reset` to rebuild
- `app/main.py`: app, CORS, lifespan (create_all + seed_if_empty), routers, `/health`
- `app/schemas.py`: Pydantic in/out models. `UTCDateTime` serializes with a trailing `Z`. `MeetingPublic` has no passcode; `MeetingOut` (owner) adds passcode + `invite_link`
- `app/exceptions.py`: `AppError(status, code, message)` → JSON `{code, detail}`. The frontend switches on `code`
- `app/dependencies.py`: `get_current_user` (the default user)
- `app/services/meetings.py`: all meeting business logic; routers stay thin
- `app/routers/users.py`, `app/routers/meetings.py`, `app/routers/ws.py` (WebSocket endpoint)
- `app/services/participants.py`: participant/chat DB ops used by the WebSocket layer
- `app/realtime/manager.py`: in-memory rooms {participant_id: socket, screen_sharer_id, raised_hands}. **Run the backend as a single worker**
- `app/realtime/handlers.py`: `@on("type", host_only=...)` handler per message type, plus `dispatch()`

## WebSocket protocol: `ws://HOST/ws/meetings/{code}?participant_id=ID`
- Flow: REST `POST /join` → get participant.id → open the socket right away. Closing the socket = leaving (left_at set; the meeting auto-ends when empty)
- Client → server: `signal {target_id, data}` · `media_state {is_muted?, is_video_off?}` · `raise_hand {raised}` · `reaction {emoji}` (👏👍❤️😂😮🎉) · `screen_share {active}` (one sharer at a time) · `chat {content}`
  Host-only: `mute_all` · `mute_participant {target_id}` · `ask_unmute {target_id}` · `remove_participant {target_id}` · `end_meeting`
- Server → client: `room_state {self_id, participants[], messages[], screen_sharer_id}` · `participant_joined {participant}` · `participant_left {participant_id}` · `participant_updated {participant}` · `signal {from_id, data}` · `chat {message}` · `reaction {participant_id, emoji}` · `screen_share {participant_id, active}` · `force_mute` · `unmute_request` · `removed` · `meeting_ended` · `error {code, detail}`
- Participant payload = ParticipantOut + `hand_raised`, `is_sharing`. Chat message = {id, participant_id, sender_name, content, sent_at}
- Close codes: 4000 replaced by another tab, 4001 invalid, 4003 removed, 4004 meeting ended
- WebRTC plan (Step 8): the newcomer sends offers to every peer listed in room_state; existing peers answer when they get an offer

## API (prefix /api, docs at /docs)
- `GET /users/me`
- `GET /meetings/upcoming` (live first, then scheduled whose end > now) · `GET /meetings/recent` (ended, newest first, max 20)
- `POST /meetings/instant` {title?, settings?} → live meeting · `POST /meetings` {title, description?, scheduled_start (any tz), duration_min 5–1440, passcode?, settings?}
- `GET /meetings/{code}` public info (the code may include spaces/dashes) · `GET /meetings/{code}/details` owner view
- `PATCH /meetings/{code}` (scheduled only) · `DELETE /meetings/{code}` (not while live)
- `POST /meetings/{code}/verify` {passcode?} → MeetingPublic; same guest checks as join, creates nothing (used by the Join dialog)
- `POST /meetings/{code}/join` {display_name, passcode?, as_host} → {participant, meeting}. Errors: 404 not_found, 401 passcode_required / wrong_passcode, 410 meeting_ended, 403 not_host
- `POST /meetings/{code}/leave` {participant_id} (the last person leaving ends the meeting) · `POST /meetings/{code}/end` (host) · `GET /meetings/{code}/participants` (active)
- Host rule (no auth): "Start" on the dashboard sends as_host=true and skips the passcode; invite links and Meeting IDs join as guests and need the passcode (links carry `?pwd=`)

## Frontend layout
- `app/globals.css`: Zoom tokens → classes like `bg-zoom-blue`, `bg-zoom-orange`, `text-ink`, `text-ink-muted`, `bg-surface-muted`, `border-line`, `shadow-popover`, `bg-meeting-bg/tile/bar`. Font: Lato
- `app/layout.tsx`: root layout. `app/(main)/layout.tsx`: pages with the TopNav (the meeting room will live outside `(main)`, with no nav)
- `app/providers.tsx`: SWRConfig + ToastProvider (wraps everything in the root layout)
- `app/(main)/page.tsx` → `components/dashboard/Dashboard.tsx` (tiles + recent on the left; ClockHero + upcoming card on the right) · `meetings/` → MeetingsTabs (Upcoming/Previous via `?tab=previous`) · `settings/`: placeholder
- `components/dashboard/`: Dashboard (owns the dialog state), ActionTiles (New meeting has a chevron "Start with video" option), ClockHero, UpcomingMeetingsList (Start/Join → `useStartMeeting().enterAsHost`), RecentMeetingsList, MeetingActionsMenu, MeetingsTabs, ListState
- `components/meetings/`: JoinForm (ID/link + name + remember/no-audio/video-off → passcode step → `api.verify` → saveJoinIntent → push `/meeting/{code}`; props presetCode/presetPasscode/mode 'join'|'share'), JoinMeetingDialog, ScheduleMeetingDialog (create + edit, then ScheduledMeetingDetails with copy link/invitation), InviteLanding (`/j/[code]?pwd=`)
- **Join intent** (`lib/joinIntent.ts`, `hooks/useJoinIntent.ts`): sessionStorage `zoom:join:{code}` = {displayName, passcode?, asHost, audioOn, videoOn, shareOnJoin?}. It's written before navigating to `/meeting/{code}`. `useJoinIntent(code)` → undefined (SSR) | null (none: show JoinForm with presetCode) | intent. The room calls `api.join` with it
- `hooks/useStartMeeting.ts`: `startInstant()` (create + enter as host), `enterAsHost(code)`; honours `prefs.startWithVideo()`
- `lib/storage.ts` (safe local/session + prefs), `lib/meetingLink.ts` (parseMeetingInput), `lib/schedule.ts` (time options, nextHalfHour, toIso, timezoneLabel, randomPasscode)
- `components/layout/`: TopNav (logo + search | NavTabs | gear + ProfileMenu), NavTabs, `navItems.ts`, ProfileMenu (dropdown), ZoomLogo (text wordmark)
- `components/ui/`: Field (Label, TextInput, TextArea, Select, Checkbox, RadioGroup, FieldError), Avatar, Button (variants primary/secondary/soft/danger/ghost, sizes sm/md/lg, `loading`), Modal, ConfirmDialog, Toast (`useToast()(msg, 'success'|'error')`), DropdownMenu, Placeholder
- `hooks/`: useCurrentUser, useMeetings (useUpcomingMeetings, useRecentMeetings, `refreshMeetingLists()`), useNow, useClickOutside
- `lib/invite.ts`: buildInvitation (Zoom's invite text), copyToClipboard
- `lib/api.ts`: `api.*` for every endpoint, `ApiError{status, code}`, SWR `keys` · `lib/types.ts` · `lib/format.ts` (formatMeetingCode, formatTime, formatRelativeDay, formatTimeRange, formatDuration, initials) · `lib/config.ts` (API_URL, WS_URL from NEXT_PUBLIC_API_URL)
- Run: `cd frontend && npm run dev` → http://localhost:3000 (the backend must be running)

## Meeting room (Steps 7–8)
- `app/meeting/[code]/page.tsx`: no intent → JoinForm; intent → `components/meeting/MeetingExperience` (stages preview → joining → room → exit). It owns `LocalMedia` via `useDisposable`, calls `api.join` (applies server mute/video-off), and when the host ends the meeting it goes straight home
- `lib/meeting/` (plain TS, read in React through `useStore(store)` from `store.ts`):
  - `localMedia.ts` LocalMedia: mic (mute = track.enabled=false), camera (off = stop track, so the light turns off), screen (getDisplayMedia, must be called from a click), friendly permission errors
  - `peer.ts` Peer: one RTCPeerConnection per remote person, **3 fixed transceivers: 0 = audio, 1 = camera, 2 = screen**; toggles use replaceTrack (no renegotiation). Signals are processed in a serial queue; ICE candidates are queued until the remote description is set; the offerer restarts ICE when the connection fails
  - `client.ts` MeetingClient: WebSocket + peers + chat/reactions/notices/host commands. The newcomer offers to everyone in room_state. participant_joined closes any stale peer. It syncs LocalMedia changes → replaceTrack + `media_state`/`screen_share`. State: status, participants, messages, unreadChat, screenSharerId, remote{camera, screen, connection}, reactions, notice, unmuteRequested. Methods: sendChat, react, setHandRaised, muteAll, muteParticipant, askToUnmute, removeParticipant, endForAll, setChatOpen, leave
  - `speaking.ts` SpeakingDetector (Web Audio RMS) → speakingIds (green border), recentSpeakers (speaker view)
  - `types.ts` protocol types, REACTIONS, CLOSE_CODES
- `hooks/useDisposable.ts`: create once, dispose on real unmount (deferred, so the Strict Mode double-mount doesn't kill the camera/socket)
- `components/meeting/`: PreJoinScreen, MeetingRoom (top bar: MeetingInfo, share banner, view toggle; VideoStage; side panel slot; Toolbar; RemoteAudio per peer; unmute-request dialog; Alt+A / Alt+V), VideoStage (gallery via `useGalleryLayout` / speaker / screen share + filmstrip), VideoTile, Toolbar (Mute, Video, Participants, Chat, React + raise hand, Share, More, End/Leave popover), MeetingInfo, EndScreen, MediaVideo, RemoteAudio
- Side panels (Step 9): `ParticipantsPanel` (search, you first then raised hands, hover host actions Mute / Ask to Unmute / "…" → Remove with confirm; footer Invite + Mute All with confirm; Waiting Room section with Admit / Remove / Admit all) and `ChatPanel` (Enter sends, Shift+Enter adds a new line, grouped messages, "Me", disabled notice when `allow_chat` is off for guests). On phones the panel covers the screen
- **Waiting room** (in-memory, per live session): `realtime/manager.py` Room.waiting/admitted/host_ids; ws.py puts non-host guests in `waiting` when `settings.waiting_room` is on and ignores their messages until they're admitted; `realtime/session.py` `enter_room()` is shared by connect and admit; handlers `admit`, `admit_all`, `deny` (host only; deny marks the participant removed). Server → client: `waiting_room`, `waiting_room_updated {waiting}`; `room_state.waiting` for hosts. Client status `waiting` → `WaitingRoomScreen`; hosts get `WaitingRoomAlert` (top right)
- Close codes and the Context/payload helpers moved to `realtime/manager.py` / `realtime/session.py`
- The mic/video toolbar carets are decorative (device picker not built)
- `next.config.ts`: `devIndicators: false` (the dev badge covered the Mute button)
- ICE: `NEXT_PUBLIC_ICE_SERVERS` (JSON) for TURN in production; defaults to Google STUN
- **Browser tests in `e2e/`** (`cd e2e && npm install && npm run all`, with the backend on :8000 using a fresh DB and the frontend on :3000): flows.mjs (join/schedule/invite), meeting.mjs (2 browsers: video/audio/mute/camera/reactions/share/end), host-controls.mjs (3 browsers: waiting room, chat, mute/ask-unmute/mute-all/remove). Tested with headless Chrome (fake devices, which need the `--disable-features=AudioServiceOutOfProcess` flag on macOS): video/audio both ways, mute, camera toggle, reactions, screen share, end for all, in both prod and dev mode

## Schema
- `users`: name, email (unique), avatar_color, personal_meeting_id (unique)
- `meetings`: meeting_code (unique 10 digits), title, description, host_id→users, type (instant|scheduled), status (scheduled|live|ended), scheduled_start, duration_min, passcode, started_at, ended_at
- `meeting_settings` (1:1, PK=meeting_id): waiting_room, mute_on_entry, host_video_on, participant_video_on, allow_chat, allow_screen_share
- `participants`: one row per join session; meeting_id, user_id (nullable = guest), display_name, role (host|participant), joined_at, left_at, is_muted, is_video_off, is_removed
- `chat_messages`: meeting_id, participant_id, content, sent_at
- All datetimes are naive UTC. The frontend converts them to local time.
- Invite link format: `{FRONTEND_URL}/j/{meeting_code}?pwd={passcode}`

## Progress
- [x] Step 1: backend scaffold, models, seed, /health
- [x] Step 2: REST API (instant create, schedule, get by code, join validation, upcoming/recent, participants)
- [x] Step 3: WebSocket signaling + host controls (mute all, remove) + chat + presence
- [x] Step 4: frontend scaffold, Zoom theme, navbar/layout, API client (screenshot: Zoom home)
- [x] Step 5: dashboard + Meetings page (the user's screenshots haven't arrived yet; the design follows Zoom Workplace from memory. Adjust it if the user sends screenshots)
- [x] Step 6: New / Join / Schedule flows + invite copy (screenshots: join dialog, schedule page)
- [x] Step 7: pre-join screen + meeting room UI (grid, toolbar) (screenshot: meeting room)
- [x] Step 8: WebRTC video/audio/screen share
- [x] Step 9: participants panel, chat panel, host controls UI, leave/end (screenshot: panels)
- [x] Step 10: responsive (phones: bottom tab bar via `NavTabs placement="bottom"` in `(main)/layout.tsx`; icon-only meeting toolbar; full-screen side panels), README with screenshots in `docs/screenshots/`, `render.yaml` (backend, 1 worker, PYTHON_VERSION 3.11), `CORS_ORIGIN_REGEX` env (Vercel previews), `.env` examples, git repo initialised on `main`
- Remaining for the user: create the GitHub repo and push, deploy on Render (set FRONTEND_URL) and Vercel (Root Directory `frontend`, NEXT_PUBLIC_API_URL), then put both URLs at the top of README.md
