"""One function per incoming WebSocket message type.

Client -> server messages look like {"type": "<name>", ...fields}.
Each handler is registered with @on("<name>") and receives the sender's context.
"""
from typing import Awaitable, Callable, Dict, List

from ..database import SessionLocal
from ..exceptions import AppError, NotFoundError
from ..models import Participant
from ..services import meetings as meeting_service
from ..services import participants as participant_service
from .manager import CLOSE_ENDED, CLOSE_REMOVED, manager
from .session import Context, chat_payload, enter_room, notify_hosts_waiting, participant_payload

ALLOWED_REACTIONS = {"👏", "👍", "❤️", "😂", "😮", "🎉"}


Handler = Callable[[Context, dict], Awaitable[None]]
HANDLERS: Dict[str, Handler] = {}
HOST_ONLY: set = set()


def on(message_type: str, host_only: bool = False) -> Callable[[Handler], Handler]:
    def register(fn: Handler) -> Handler:
        HANDLERS[message_type] = fn
        if host_only:
            HOST_ONLY.add(message_type)
        return fn

    return register


async def dispatch(ctx: Context, message: dict) -> None:
    handler = HANDLERS.get(message.get("type", ""))
    if handler is None:
        raise AppError(400, "unknown_type", f"Unknown message type: {message.get('type')!r}")
    if message["type"] in HOST_ONLY and not ctx.is_host:
        raise AppError(403, "not_host", "Only the host can do this.")
    await handler(ctx, message)


async def _broadcast_updated(ctx: Context, participants: List[Participant]) -> None:
    room = manager.get_room(ctx.code)
    for participant in participants:
        await manager.broadcast(
            ctx.code, {"type": "participant_updated", "participant": participant_payload(participant, room)}
        )


def _target_id(message: dict) -> int:
    target = message.get("target_id")
    if not isinstance(target, int):
        raise AppError(422, "missing_target", "target_id is required.")
    return target


# ---------- WebRTC signaling ----------

@on("signal")
async def handle_signal(ctx: Context, message: dict) -> None:
    """Relay an SDP offer/answer or ICE candidate to one peer. The server never reads `data`."""
    await manager.send(
        ctx.code, _target_id(message), {"type": "signal", "from_id": ctx.participant_id, "data": message.get("data")}
    )


# ---------- Own media / presence ----------

@on("media_state")
async def handle_media_state(ctx: Context, message: dict) -> None:
    """{"type": "media_state", "is_muted"?: bool, "is_video_off"?: bool}"""
    with SessionLocal() as db:
        participant = participant_service.set_media_state(
            db, ctx.participant_id, is_muted=message.get("is_muted"), is_video_off=message.get("is_video_off")
        )
        await _broadcast_updated(ctx, [participant])


@on("raise_hand")
async def handle_raise_hand(ctx: Context, message: dict) -> None:
    room = manager.get_room(ctx.code)
    if message.get("raised"):
        room.raised_hands.add(ctx.participant_id)
    else:
        room.raised_hands.discard(ctx.participant_id)
    with SessionLocal() as db:
        await _broadcast_updated(ctx, [db.get(Participant, ctx.participant_id)])


@on("reaction")
async def handle_reaction(ctx: Context, message: dict) -> None:
    emoji = message.get("emoji")
    if emoji not in ALLOWED_REACTIONS:
        raise AppError(422, "bad_reaction", "Unsupported reaction.")
    await manager.broadcast(ctx.code, {"type": "reaction", "participant_id": ctx.participant_id, "emoji": emoji})


@on("screen_share")
async def handle_screen_share(ctx: Context, message: dict) -> None:
    """{"type": "screen_share", "active": bool}. Only one person can share at a time, like Zoom's default."""
    room = manager.get_room(ctx.code)
    with SessionLocal() as db:
        participant = db.get(Participant, ctx.participant_id)
        if message.get("active"):
            if not ctx.is_host and not participant.meeting.settings.allow_screen_share:
                raise AppError(403, "share_disabled", "The host has disabled screen sharing.")
            if room.screen_sharer_id not in (None, ctx.participant_id):
                raise AppError(409, "someone_sharing", "Someone else is already sharing their screen.")
            room.screen_sharer_id = ctx.participant_id
        elif room.screen_sharer_id == ctx.participant_id:
            room.screen_sharer_id = None
        await manager.broadcast(
            ctx.code, {"type": "screen_share", "participant_id": ctx.participant_id, "active": bool(message.get("active"))}
        )
        await _broadcast_updated(ctx, [participant])


# ---------- Chat ----------

@on("chat")
async def handle_chat(ctx: Context, message: dict) -> None:
    """{"type": "chat", "content": str}. Saved to the DB, then sent to everyone (including the sender)."""
    with SessionLocal() as db:
        participant = db.get(Participant, ctx.participant_id)
        if not ctx.is_host and not participant.meeting.settings.allow_chat:
            raise AppError(403, "chat_disabled", "The host has disabled chat.")
        saved = participant_service.save_chat_message(db, ctx.participant_id, str(message.get("content", "")))
        await manager.broadcast(ctx.code, {"type": "chat", "message": chat_payload(saved)})


# ---------- Host controls ----------

@on("mute_all", host_only=True)
async def handle_mute_all(ctx: Context, _message: dict) -> None:
    with SessionLocal() as db:
        changed = participant_service.mute_all(db, ctx.meeting_id)
        # force_mute tells each client to switch off its microphone
        await manager.broadcast(ctx.code, {"type": "force_mute"}, exclude=ctx.participant_id)
        await _broadcast_updated(ctx, changed)


@on("mute_participant", host_only=True)
async def handle_mute_participant(ctx: Context, message: dict) -> None:
    target_id = _target_id(message)
    with SessionLocal() as db:
        participant_service.get_target(db, ctx.meeting_id, target_id)
        target = participant_service.set_media_state(db, target_id, is_muted=True)
        await manager.send(ctx.code, target_id, {"type": "force_mute"})
        await _broadcast_updated(ctx, [target])


@on("ask_unmute", host_only=True)
async def handle_ask_unmute(ctx: Context, message: dict) -> None:
    """Hosts can't force someone's mic on (same as Zoom); the participant gets a prompt instead."""
    await manager.send(ctx.code, _target_id(message), {"type": "unmute_request"})


@on("remove_participant", host_only=True)
async def handle_remove(ctx: Context, message: dict) -> None:
    target_id = _target_id(message)
    with SessionLocal() as db:
        participant_service.remove_participant(db, ctx.meeting_id, target_id)
    await manager.kick(ctx.code, target_id, {"type": "removed"}, CLOSE_REMOVED)
    await manager.broadcast(ctx.code, {"type": "participant_left", "participant_id": target_id})


@on("end_meeting", host_only=True)
async def handle_end_meeting(ctx: Context, _message: dict) -> None:
    with SessionLocal() as db:
        meeting = meeting_service.get_meeting_or_404(db, ctx.code)
        meeting_service.finish_meeting(db, meeting)
    await manager.close_room(ctx.code, {"type": "meeting_ended"}, CLOSE_ENDED)


# ---------- Waiting room (host) ----------

async def _admit(ctx: Context, target_id: int) -> None:
    entry = manager.pop_waiting(ctx.code, target_id)
    if entry is None:
        raise NotFoundError("That person is no longer in the waiting room.")
    manager.get_room(ctx.code).admitted.add(target_id)
    await enter_room(Context(ctx.code, ctx.meeting_id, target_id, is_host=False), entry.ws)


@on("admit", host_only=True)
async def handle_admit(ctx: Context, message: dict) -> None:
    await _admit(ctx, _target_id(message))
    await notify_hosts_waiting(ctx.code)


@on("admit_all", host_only=True)
async def handle_admit_all(ctx: Context, _message: dict) -> None:
    for person in manager.waiting_list(ctx.code):
        await _admit(ctx, person["id"])
    await notify_hosts_waiting(ctx.code)


@on("deny", host_only=True)
async def handle_deny(ctx: Context, message: dict) -> None:
    """Remove someone from the waiting room (they can't rejoin with the same session)."""
    target_id = _target_id(message)
    entry = manager.pop_waiting(ctx.code, target_id)
    if entry is None:
        raise NotFoundError("That person is no longer in the waiting room.")
    with SessionLocal() as db:
        participant_service.remove_participant(db, ctx.meeting_id, target_id)
    try:
        await entry.ws.send_json({"type": "removed"})
        await entry.ws.close(code=CLOSE_REMOVED)
    except Exception:
        pass
    await notify_hosts_waiting(ctx.code)
