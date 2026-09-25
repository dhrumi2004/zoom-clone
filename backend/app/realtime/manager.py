"""In-memory state of live meetings: open sockets, who is in which room, and session-only settings.

Lives in the server process, so the backend must run as a single worker
(fine for this project; a multi-server setup would use Redis pub/sub instead).

A meeting has a main room (id 0) and, while breakout rooms are open, rooms 1..n.
Each room is its own WebRTC mesh: people only connect to, see and chat with others in their room.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

from fastapi import WebSocket

# WebSocket close codes (4000-4999 are free for apps to use)
CLOSE_REPLACED = 4000  # same participant connected from another tab
CLOSE_INVALID = 4001  # bad participant / meeting at connect time
CLOSE_REMOVED = 4003  # host removed this participant (or denied entry from the waiting room)
CLOSE_ENDED = 4004  # host ended the meeting for everyone

MAIN_ROOM = 0


@dataclass
class WaitingEntry:
    ws: WebSocket
    display_name: str


@dataclass
class LiveMeeting:
    sockets: Dict[int, WebSocket] = field(default_factory=dict)  # admitted, connected participants
    location: Dict[int, int] = field(default_factory=dict)  # participant -> room id (missing = main room)
    screen_sharers: Dict[int, int] = field(default_factory=dict)  # room id -> participant sharing there
    raised_hands: Set[int] = field(default_factory=set)
    host_ids: Set[int] = field(default_factory=set)
    cohost_ids: Set[int] = field(default_factory=set)
    waiting: Dict[int, WaitingEntry] = field(default_factory=dict)
    admitted: Set[int] = field(default_factory=set)  # let in from the waiting room (survives reconnects)
    locked: bool = False
    spotlight_id: Optional[int] = None
    recording_ids: Set[int] = field(default_factory=set)
    breakout_rooms: Dict[int, str] = field(default_factory=dict)  # room id -> name; empty = closed

    def room_of(self, participant_id: int) -> int:
        return self.location.get(participant_id, MAIN_ROOM)

    def members(self, room_id: int) -> List[int]:
        return [pid for pid in self.sockets if self.room_of(pid) == room_id]

    def is_moderator(self, participant_id: int) -> bool:
        return participant_id in self.host_ids or participant_id in self.cohost_ids


class ConnectionManager:
    def __init__(self) -> None:
        self._meetings: Dict[str, LiveMeeting] = {}

    def get(self, code: str) -> LiveMeeting:
        """Live state for a meeting, created on first use."""
        return self._meetings.setdefault(code, LiveMeeting())

    def find(self, code: str) -> Optional[LiveMeeting]:
        return self._meetings.get(code)

    def is_locked(self, code: str) -> bool:
        live = self._meetings.get(code)
        return bool(live and live.locked)

    # ---------- connections ----------

    def connect(self, code: str, participant_id: int, ws: WebSocket) -> Optional[WebSocket]:
        """Register a socket. Returns the old socket if this participant was already connected (e.g. a second tab)."""
        live = self.get(code)
        previous = live.sockets.get(participant_id)
        live.sockets[participant_id] = ws
        return previous

    def disconnect(self, code: str, participant_id: int, ws: WebSocket) -> Optional[int]:
        """Forget a socket. Returns the room it was in, or None if it was already replaced/removed (skip cleanup)."""
        live = self._meetings.get(code)
        if live is None or live.sockets.get(participant_id) is not ws:
            return None
        room_id = live.room_of(participant_id)
        del live.sockets[participant_id]
        live.location.pop(participant_id, None)
        live.raised_hands.discard(participant_id)
        live.recording_ids.discard(participant_id)
        if live.screen_sharers.get(room_id) == participant_id:
            del live.screen_sharers[room_id]
        if live.spotlight_id == participant_id:
            live.spotlight_id = None
        self._drop_if_empty(code, live)
        return room_id

    def is_in_room(self, code: str, participant_id: int, ws: WebSocket) -> bool:
        live = self._meetings.get(code)
        return live is not None and live.sockets.get(participant_id) is ws

    # ---------- sending ----------

    async def send(self, code: str, participant_id: int, message: dict) -> None:
        live = self._meetings.get(code)
        ws = live.sockets.get(participant_id) if live else None
        if ws is not None:
            await _safe_send(ws, message)

    async def broadcast_room(self, code: str, room_id: int, message: dict, exclude: Optional[int] = None) -> None:
        live = self._meetings.get(code)
        if live is None:
            return
        for pid in live.members(room_id):
            if pid != exclude:
                await _safe_send(live.sockets[pid], message)

    async def broadcast_all(self, code: str, message: dict, exclude: Optional[int] = None) -> None:
        """Everyone in the meeting, including breakout rooms."""
        live = self._meetings.get(code)
        if live is None:
            return
        for pid, ws in list(live.sockets.items()):
            if pid != exclude:
                await _safe_send(ws, message)

    async def send_to_moderators(self, code: str, message: dict) -> None:
        live = self._meetings.get(code)
        if live is None:
            return
        for pid, ws in list(live.sockets.items()):
            if live.is_moderator(pid):
                await _safe_send(ws, message)

    async def kick(self, code: str, participant_id: int, message: dict, close_code: int) -> Optional[int]:
        """Tell one participant why, then close their socket. Returns the room they were in."""
        live = self._meetings.get(code)
        ws = live.sockets.get(participant_id) if live else None
        if ws is None:
            return None
        room_id = self.disconnect(code, participant_id, ws)
        await _safe_send(ws, message)
        await _safe_close(ws, close_code)
        return room_id

    async def close_meeting(self, code: str, message: dict, close_code: int) -> None:
        live = self._meetings.pop(code, None)
        if live is None:
            return
        for ws in list(live.sockets.values()) + [e.ws for e in live.waiting.values()]:
            await _safe_send(ws, message)
            await _safe_close(ws, close_code)

    # ---------- waiting room ----------

    def add_waiting(self, code: str, participant_id: int, ws: WebSocket, display_name: str) -> Optional[WebSocket]:
        live = self.get(code)
        previous = live.waiting.get(participant_id)
        live.waiting[participant_id] = WaitingEntry(ws, display_name)
        return previous.ws if previous else None

    def pop_waiting(self, code: str, participant_id: int) -> Optional[WaitingEntry]:
        live = self._meetings.get(code)
        return live.waiting.pop(participant_id, None) if live else None

    def remove_waiting(self, code: str, participant_id: int, ws: WebSocket) -> bool:
        """Forget a waiting socket that disconnected. False if it wasn't (or no longer is) waiting."""
        live = self._meetings.get(code)
        entry = live.waiting.get(participant_id) if live else None
        if entry is None or entry.ws is not ws:
            return False
        del live.waiting[participant_id]
        self._drop_if_empty(code, live)
        return True

    def waiting_list(self, code: str) -> List[dict]:
        live = self._meetings.get(code)
        if live is None:
            return []
        return [{"id": pid, "display_name": e.display_name} for pid, e in live.waiting.items()]

    def _drop_if_empty(self, code: str, live: LiveMeeting) -> None:
        if not live.sockets and not live.waiting:
            self._meetings.pop(code, None)


async def _safe_send(ws: WebSocket, message: dict) -> None:
    # A client can vanish at any moment; one dead socket must not break a broadcast.
    try:
        await ws.send_json(message)
    except Exception:
        pass


async def _safe_close(ws: WebSocket, close_code: int) -> None:
    try:
        await ws.close(code=close_code)
    except Exception:
        pass


manager = ConnectionManager()
