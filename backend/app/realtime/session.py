"""Room membership: entering the meeting, moving between breakout rooms, and the state each person is sent."""
from dataclasses import dataclass

from fastapi import WebSocket
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import ChatMessage, Meeting, Participant
from ..schemas import ChatMessageOut, MeetingSettingsOut, ParticipantOut
from ..services import participants as participant_service
from ..services import polls as poll_service
from .manager import CLOSE_REPLACED, MAIN_ROOM, LiveMeeting, manager


@dataclass
class Context:
    code: str  # normalized meeting code (key of the live meeting)
    meeting_id: int
    participant_id: int
    is_host: bool

    @property
    def live(self) -> LiveMeeting:
        return manager.get(self.code)

    @property
    def room_id(self) -> int:
        """The room this person is in right now (0 = main room, 1..n = breakout rooms)."""
        return self.live.room_of(self.participant_id)

    @property
    def is_moderator(self) -> bool:
        """Host or co-host."""
        return self.is_host or self.live.is_moderator(self.participant_id)


# ---------- payloads ----------

def participant_payload(participant: Participant, live: LiveMeeting) -> dict:
    data = ParticipantOut.model_validate(participant).model_dump(mode="json")
    data["hand_raised"] = participant.id in live.raised_hands
    data["is_sharing"] = participant.id in live.screen_sharers.values()
    data["is_cohost"] = participant.id in live.cohost_ids
    return data


def chat_payload(message: ChatMessage) -> dict:
    return ChatMessageOut.model_validate(message).model_dump(mode="json")


def security_payload(meeting: Meeting, live: LiveMeeting) -> dict:
    return {
        "type": "security",
        "locked": live.locked,
        "settings": MeetingSettingsOut.model_validate(meeting.settings).model_dump(mode="json"),
    }


def breakout_payload(db: Session, live: LiveMeeting) -> dict:
    names = {}
    if live.sockets:
        rows = db.query(Participant.id, Participant.display_name).filter(Participant.id.in_(list(live.sockets))).all()
        names = dict(rows)
    rooms = [
        {
            "id": rid,
            "name": name,
            "participants": [{"id": pid, "display_name": names.get(pid, "")} for pid in live.members(rid)],
        }
        for rid, name in sorted(live.breakout_rooms.items())
    ]
    return {"type": "breakout_state", "open": bool(live.breakout_rooms), "rooms": rooms}


def polls_payload(db: Session, meeting: Meeting, viewer_id: int, is_moderator: bool) -> list:
    return [poll_service.to_payload(db, p, viewer_id, is_moderator) for p in poll_service.session_polls(db, meeting)]


# ---------- entering / moving ----------

async def send_room_state(ctx: Context) -> None:
    """Everything a person needs to render their current room and start WebRTC offers to each peer in it."""
    live = ctx.live
    with SessionLocal() as db:
        participant = db.get(Participant, ctx.participant_id)
        meeting = participant.meeting
        in_room = set(live.members(ctx.room_id))
        people = [p for p in participant_service.active_participants(db, meeting.id) if p.id in in_room]
        await manager.send(
            ctx.code,
            ctx.participant_id,
            {
                "type": "room_state",
                "self_id": participant.id,
                "room_id": ctx.room_id,
                "room_name": live.breakout_rooms.get(ctx.room_id),
                "participants": [participant_payload(p, live) for p in people],
                "messages": [chat_payload(m) for m in participant_service.recent_messages(db, meeting, participant.id)],
                "screen_sharer_id": live.screen_sharers.get(ctx.room_id),
                "spotlight_id": live.spotlight_id,
                "recording": bool(live.recording_ids),
                "waiting": manager.waiting_list(ctx.code) if ctx.is_moderator else [],
                "polls": polls_payload(db, meeting, participant.id, ctx.is_moderator),
                "security": {k: v for k, v in security_payload(meeting, live).items() if k != "type"},
                "breakout": {k: v for k, v in breakout_payload(db, live).items() if k != "type"},
            },
        )


async def enter_room(ctx: Context, ws: WebSocket) -> None:
    """Register the socket (main room), send the newcomer the room state, and tell the room they arrived."""
    previous = manager.connect(ctx.code, ctx.participant_id, ws)
    if ctx.is_host:
        ctx.live.host_ids.add(ctx.participant_id)
    await send_room_state(ctx)
    if previous is not None:
        await previous.close(code=CLOSE_REPLACED)
    else:
        await announce_join(ctx)


async def announce_join(ctx: Context) -> None:
    with SessionLocal() as db:
        participant = db.get(Participant, ctx.participant_id)
        payload = {"type": "participant_joined", "participant": participant_payload(participant, ctx.live)}
    await manager.broadcast_room(ctx.code, ctx.room_id, payload, exclude=ctx.participant_id)


async def move_to_room(code: str, meeting_id: int, participant_id: int, room_id: int) -> None:
    """Breakout rooms: leave the current mesh, join another. The client rebuilds its peers from the new room_state."""
    live = manager.get(code)
    old = live.room_of(participant_id)
    if old == room_id or participant_id not in live.sockets:
        return
    if live.screen_sharers.get(old) == participant_id:
        del live.screen_sharers[old]
        await manager.broadcast_room(code, old, {"type": "screen_share", "participant_id": participant_id, "active": False})
    await manager.broadcast_room(code, old, {"type": "participant_left", "participant_id": participant_id}, exclude=participant_id)
    if room_id == MAIN_ROOM:
        live.location.pop(participant_id, None)
    else:
        live.location[participant_id] = room_id
    ctx = Context(code, meeting_id, participant_id, is_host=participant_id in live.host_ids)
    await send_room_state(ctx)
    await announce_join(ctx)


async def broadcast_breakout_state(code: str) -> None:
    with SessionLocal() as db:
        payload = breakout_payload(db, manager.get(code))
    await manager.broadcast_all(code, payload)


async def notify_hosts_waiting(code: str) -> None:
    """Hosts and co-hosts see the waiting room list update live."""
    await manager.send_to_moderators(code, {"type": "waiting_room_updated", "waiting": manager.waiting_list(code)})


async def broadcast_poll(code: str, meeting_id: int, poll_id: int) -> None:
    """Each person gets their own view of a poll (results only for moderators, or once shared)."""
    live = manager.get(code)
    with SessionLocal() as db:
        poll = poll_service.load_poll(db, meeting_id, poll_id)
        for pid in list(live.sockets):
            await manager.send(code, pid, {"type": "poll", "poll": poll_service.to_payload(db, poll, pid, live.is_moderator(pid))})
