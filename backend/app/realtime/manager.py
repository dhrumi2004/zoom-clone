"""In-memory registry of open WebSocket connections, grouped by meeting.

Lives in the server process, so the backend must run as a single worker
(fine for this project; a multi-server setup would use Redis pub/sub instead).
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

from fastapi import WebSocket

# WebSocket close codes (4000-4999 are free for apps to use)
CLOSE_REPLACED = 4000  # same participant connected from another tab
CLOSE_INVALID = 4001  # bad participant / meeting at connect time
CLOSE_REMOVED = 4003  # host removed this participant (or denied entry from the waiting room)
CLOSE_ENDED = 4004  # host ended the meeting for everyone


@dataclass
class WaitingEntry:
    ws: WebSocket
    display_name: str


@dataclass
class Room:
    connections: Dict[int, WebSocket] = field(default_factory=dict)  # participant_id -> socket
    screen_sharer_id: Optional[int] = None
    raised_hands: Set[int] = field(default_factory=set)
    host_ids: Set[int] = field(default_factory=set)
    # Waiting room: connected but not let in yet. `admitted` survives reconnects during this session.
    waiting: Dict[int, WaitingEntry] = field(default_factory=dict)
    admitted: Set[int] = field(default_factory=set)


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: Dict[str, Room] = {}

    def get_room(self, code: str) -> Room:
        """Room for a meeting, created on first use."""
        return self._rooms.setdefault(code, Room())

    def find_room(self, code: str) -> Optional[Room]:
        """Room if it exists, without creating one."""
        return self._rooms.get(code)

    def connect(self, code: str, participant_id: int, ws: WebSocket) -> Optional[WebSocket]:
        """Register a socket. Returns the old socket if this participant was already connected (e.g. a second tab)."""
        room = self.get_room(code)
        previous = room.connections.get(participant_id)
        room.connections[participant_id] = ws
        return previous

    def disconnect(self, code: str, participant_id: int, ws: WebSocket) -> bool:
        """Forget a socket. Returns False if it was already replaced or removed, so the caller skips cleanup."""
        room = self._rooms.get(code)
        if room is None or room.connections.get(participant_id) is not ws:
            return False
        del room.connections[participant_id]
        room.raised_hands.discard(participant_id)
        if room.screen_sharer_id == participant_id:
            room.screen_sharer_id = None
        self._drop_if_empty(code, room)
        return True

    # ---------- waiting room ----------

    def add_waiting(self, code: str, participant_id: int, ws: WebSocket, display_name: str) -> Optional[WebSocket]:
        room = self.get_room(code)
        previous = room.waiting.get(participant_id)
        room.waiting[participant_id] = WaitingEntry(ws, display_name)
        return previous.ws if previous else None

    def pop_waiting(self, code: str, participant_id: int) -> Optional[WaitingEntry]:
        room = self._rooms.get(code)
        return room.waiting.pop(participant_id, None) if room else None

    def remove_waiting(self, code: str, participant_id: int, ws: WebSocket) -> bool:
        """Forget a waiting socket that disconnected. False if it wasn't (or no longer is) waiting."""
        room = self._rooms.get(code)
        entry = room.waiting.get(participant_id) if room else None
        if entry is None or entry.ws is not ws:
            return False
        del room.waiting[participant_id]
        self._drop_if_empty(code, room)
        return True

    def waiting_list(self, code: str) -> List[dict]:
        room = self._rooms.get(code)
        if room is None:
            return []
        return [{"id": pid, "display_name": e.display_name} for pid, e in room.waiting.items()]

    def is_in_room(self, code: str, participant_id: int, ws: WebSocket) -> bool:
        room = self._rooms.get(code)
        return room is not None and room.connections.get(participant_id) is ws

    async def send_to_hosts(self, code: str, message: dict) -> None:
        room = self._rooms.get(code)
        if room is None:
            return
        for host_id in list(room.host_ids):
            ws = room.connections.get(host_id)
            if ws is not None:
                await _safe_send(ws, message)

    def _drop_if_empty(self, code: str, room: Room) -> None:
        if not room.connections and not room.waiting:
            self._rooms.pop(code, None)

    async def send(self, code: str, participant_id: int, message: dict) -> None:
        room = self._rooms.get(code)
        ws = room.connections.get(participant_id) if room else None
        if ws is not None:
            await _safe_send(ws, message)

    async def broadcast(self, code: str, message: dict, exclude: Optional[int] = None) -> None:
        room = self._rooms.get(code)
        if room is None:
            return
        for participant_id, ws in list(room.connections.items()):
            if participant_id != exclude:
                await _safe_send(ws, message)

    async def kick(self, code: str, participant_id: int, message: dict, close_code: int) -> None:
        """Tell one participant why, then close their socket."""
        room = self._rooms.get(code)
        ws = room.connections.get(participant_id) if room else None
        if ws is None:
            return
        self.disconnect(code, participant_id, ws)
        await _safe_send(ws, message)
        await _safe_close(ws, close_code)

    async def close_room(self, code: str, message: dict, close_code: int) -> None:
        room = self._rooms.pop(code, None)
        if room is None:
            return
        sockets = list(room.connections.values()) + [e.ws for e in room.waiting.values()]
        for ws in sockets:
            await _safe_send(ws, message)
            await _safe_close(ws, close_code)


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
