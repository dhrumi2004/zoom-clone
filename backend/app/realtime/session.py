"""Putting a connected participant into the room (used on connect and when the host admits someone)."""
from dataclasses import dataclass

from fastapi import WebSocket

from ..database import SessionLocal
from ..models import ChatMessage, Participant
from ..schemas import ChatMessageOut, ParticipantOut
from ..services import participants as participant_service
from .manager import CLOSE_REPLACED, Room, manager


@dataclass
class Context:
    code: str  # normalized meeting code, used as the room key
    meeting_id: int
    participant_id: int
    is_host: bool


def participant_payload(participant: Participant, room: Room) -> dict:
    data = ParticipantOut.model_validate(participant).model_dump(mode="json")
    data["hand_raised"] = participant.id in room.raised_hands
    data["is_sharing"] = room.screen_sharer_id == participant.id
    return data


def chat_payload(message: ChatMessage) -> dict:
    return ChatMessageOut.model_validate(message).model_dump(mode="json")


async def enter_room(ctx: Context, ws: WebSocket) -> None:
    """Register the socket, send the newcomer everything it needs, and tell everyone else."""
    previous = manager.connect(ctx.code, ctx.participant_id, ws)
    room = manager.get_room(ctx.code)
    if ctx.is_host:
        room.host_ids.add(ctx.participant_id)

    with SessionLocal() as db:
        participant = db.get(Participant, ctx.participant_id)
        meeting = participant.meeting
        await ws.send_json(
            {
                "type": "room_state",
                "self_id": participant.id,
                # Only people with an open connection (someone who joined over REST but never connected,
                # or is still in the waiting room, would otherwise show up as a frozen tile).
                "participants": [
                    participant_payload(p, room)
                    for p in participant_service.active_participants(db, meeting.id)
                    if p.id in room.connections
                ],
                "messages": [chat_payload(m) for m in participant_service.recent_messages(db, meeting)],
                "screen_sharer_id": room.screen_sharer_id,
                "waiting": manager.waiting_list(ctx.code) if ctx.is_host else [],
            }
        )
        if previous is not None:
            await previous.close(code=CLOSE_REPLACED)
        else:
            await manager.broadcast(
                ctx.code,
                {"type": "participant_joined", "participant": participant_payload(participant, room)},
                exclude=ctx.participant_id,
            )


async def notify_hosts_waiting(code: str) -> None:
    """Hosts see the waiting room list update live."""
    await manager.send_to_hosts(code, {"type": "waiting_room_updated", "waiting": manager.waiting_list(code)})
