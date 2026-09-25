"""One function per incoming WebSocket message type.

Client -> server messages look like {"type": "<name>", ...fields}.
Each handler is registered with @on("<name>", role=...) and receives the sender's context:
  role=None         anyone in the meeting
  role="moderator"  host or co-host
  role="host"       the host only (end meeting, make co-host)
"""
from typing import Awaitable, Callable, Dict, List, Optional

from ..database import SessionLocal
from ..exceptions import AppError, NotFoundError
from ..models import Participant, ParticipantRole
from ..services import meetings as meeting_service
from ..services import participants as participant_service
from ..services import polls as poll_service
from .manager import CLOSE_ENDED, CLOSE_REMOVED, MAIN_ROOM, manager
from .session import (
    Context,
    broadcast_breakout_state,
    broadcast_poll,
    chat_payload,
    enter_room,
    move_to_room,
    notify_hosts_waiting,
    participant_payload,
    security_payload,
)

ALLOWED_REACTIONS = {"👏", "👍", "❤️", "😂", "😮", "🎉"}
MAX_BREAKOUT_ROOMS = 20
MAX_CAPTION_LENGTH = 500

Handler = Callable[[Context, dict], Awaitable[None]]
HANDLERS: Dict[str, Handler] = {}
ROLES: Dict[str, str] = {}


def on(message_type: str, role: Optional[str] = None) -> Callable[[Handler], Handler]:
    def register(fn: Handler) -> Handler:
        HANDLERS[message_type] = fn
        if role:
            ROLES[message_type] = role
        return fn

    return register


async def dispatch(ctx: Context, message: dict) -> None:
    handler = HANDLERS.get(message.get("type", ""))
    if handler is None:
        raise AppError(400, "unknown_type", f"Unknown message type: {message.get('type')!r}")
    role = ROLES.get(message["type"])
    if role == "host" and not ctx.is_host:
        raise AppError(403, "not_host", "Only the host can do this.")
    if role == "moderator" and not ctx.is_moderator:
        raise AppError(403, "not_host", "Only the host or a co-host can do this.")
    await handler(ctx, message)


# ---------- helpers ----------

async def _broadcast_updated(ctx: Context, participants: List[Participant]) -> None:
    """Participant changes go to the whole meeting; clients ignore people who aren't in their room."""
    for participant in participants:
        await manager.broadcast_all(
            ctx.code, {"type": "participant_updated", "participant": participant_payload(participant, ctx.live)}
        )


def _target_id(message: dict) -> int:
    target = message.get("target_id")
    if not isinstance(target, int):
        raise AppError(422, "missing_target", "target_id is required.")
    return target


def _settings(db, ctx: Context):
    return db.get(Participant, ctx.participant_id).meeting.settings


def _protect_host(db, ctx: Context, target_id: int) -> Participant:
    """Co-hosts can manage participants but not the host."""
    target = participant_service.get_target(db, ctx.meeting_id, target_id)
    if target.role == ParticipantRole.HOST and not ctx.is_host:
        raise AppError(403, "cannot_manage_host", "Co-hosts can't do this to the host.")
    return target


# ---------- WebRTC signaling ----------

@on("signal")
async def handle_signal(ctx: Context, message: dict) -> None:
    """Relay an SDP offer/answer or ICE candidate to one peer. The server never reads `data`."""
    target = _target_id(message)
    if ctx.live.room_of(target) != ctx.room_id:
        return  # they moved to another room meanwhile
    await manager.send(ctx.code, target, {"type": "signal", "from_id": ctx.participant_id, "data": message.get("data")})


# ---------- Own media / presence ----------

@on("media_state")
async def handle_media_state(ctx: Context, message: dict) -> None:
    """{"type": "media_state", "is_muted"?: bool, "is_video_off"?: bool}"""
    with SessionLocal() as db:
        me = db.get(Participant, ctx.participant_id)
        wants_unmute = message.get("is_muted") is False and me.is_muted
        if wants_unmute and not ctx.is_moderator and not me.meeting.settings.allow_unmute:
            # Security > "Allow participants to unmute themselves" is off: keep them muted.
            await manager.send(ctx.code, ctx.participant_id, {"type": "force_mute"})
            raise AppError(403, "unmute_disabled", "The host has disabled unmuting. Raise your hand to ask to speak.")
        participant = participant_service.set_media_state(
            db, ctx.participant_id, is_muted=message.get("is_muted"), is_video_off=message.get("is_video_off")
        )
        await _broadcast_updated(ctx, [participant])


@on("raise_hand")
async def handle_raise_hand(ctx: Context, message: dict) -> None:
    if message.get("raised"):
        ctx.live.raised_hands.add(ctx.participant_id)
    else:
        ctx.live.raised_hands.discard(ctx.participant_id)
    with SessionLocal() as db:
        await _broadcast_updated(ctx, [db.get(Participant, ctx.participant_id)])


@on("reaction")
async def handle_reaction(ctx: Context, message: dict) -> None:
    emoji = message.get("emoji")
    if emoji not in ALLOWED_REACTIONS:
        raise AppError(422, "bad_reaction", "Unsupported reaction.")
    await manager.broadcast_room(ctx.code, ctx.room_id, {"type": "reaction", "participant_id": ctx.participant_id, "emoji": emoji})


@on("screen_share")
async def handle_screen_share(ctx: Context, message: dict) -> None:
    """{"type": "screen_share", "active": bool}. One person shares at a time per room, like Zoom's default."""
    live, room = ctx.live, ctx.room_id
    active = bool(message.get("active"))
    with SessionLocal() as db:
        if active:
            if not ctx.is_moderator and not _settings(db, ctx).allow_screen_share:
                raise AppError(403, "share_disabled", "The host has disabled screen sharing.")
            if live.screen_sharers.get(room) not in (None, ctx.participant_id):
                raise AppError(409, "someone_sharing", "Someone else is already sharing their screen.")
            live.screen_sharers[room] = ctx.participant_id
        elif live.screen_sharers.get(room) == ctx.participant_id:
            del live.screen_sharers[room]
        await manager.broadcast_room(ctx.code, room, {"type": "screen_share", "participant_id": ctx.participant_id, "active": active})
        await _broadcast_updated(ctx, [db.get(Participant, ctx.participant_id)])


@on("rename")
async def handle_rename(ctx: Context, message: dict) -> None:
    """{"type": "rename", "name": str, "target_id"?: int}. Hosts/co-hosts can rename anyone."""
    target_id = message.get("target_id") or ctx.participant_id
    with SessionLocal() as db:
        if target_id != ctx.participant_id:
            if not ctx.is_moderator:
                raise AppError(403, "not_host", "Only the host can rename other people.")
            _protect_host(db, ctx, target_id)
        elif not ctx.is_moderator and not _settings(db, ctx).allow_rename:
            raise AppError(403, "rename_disabled", "The host has disabled renaming.")
        participant = participant_service.rename(db, target_id, str(message.get("name", "")))
        await _broadcast_updated(ctx, [participant])


@on("caption")
async def handle_caption(ctx: Context, message: dict) -> None:
    """Live captions: each browser transcribes its own microphone and shares the text with its room."""
    text = str(message.get("text", ""))[:MAX_CAPTION_LENGTH]
    if text.strip():
        await manager.broadcast_room(
            ctx.code,
            ctx.room_id,
            {"type": "caption", "participant_id": ctx.participant_id, "text": text, "final": bool(message.get("final"))},
            exclude=ctx.participant_id,
        )


# ---------- Chat ----------

@on("chat")
async def handle_chat(ctx: Context, message: dict) -> None:
    """{"type": "chat", "content": str, "to_id"?: int}. Without to_id it goes to everyone in the room."""
    to_id = message.get("to_id")
    with SessionLocal() as db:
        if not ctx.is_moderator and not _settings(db, ctx).allow_chat:
            # Like Zoom's "Host and co-hosts" chat setting: participants may still message moderators privately.
            if not (isinstance(to_id, int) and ctx.live.is_moderator(to_id)):
                raise AppError(403, "chat_disabled", "The host has limited chat to the host and co-hosts.")
        saved = participant_service.save_chat_message(
            db, ctx.participant_id, str(message.get("content", "")), to_id if isinstance(to_id, int) else None
        )
        payload = {"type": "chat", "message": chat_payload(saved)}
    if saved.recipient_id is None:
        await manager.broadcast_room(ctx.code, ctx.room_id, payload)
    else:
        await manager.send(ctx.code, ctx.participant_id, payload)
        await manager.send(ctx.code, saved.recipient_id, payload)


# ---------- Host / co-host controls ----------

@on("mute_all", role="moderator")
async def handle_mute_all(ctx: Context, _message: dict) -> None:
    with SessionLocal() as db:
        changed = participant_service.mute_all(db, ctx.meeting_id, keep_ids=ctx.live.cohost_ids)
        for p in changed:
            await manager.send(ctx.code, p.id, {"type": "force_mute"})
        await _broadcast_updated(ctx, changed)


@on("mute_participant", role="moderator")
async def handle_mute_participant(ctx: Context, message: dict) -> None:
    target_id = _target_id(message)
    with SessionLocal() as db:
        _protect_host(db, ctx, target_id)
        target = participant_service.set_media_state(db, target_id, is_muted=True)
        await manager.send(ctx.code, target_id, {"type": "force_mute"})
        await _broadcast_updated(ctx, [target])


@on("ask_unmute", role="moderator")
async def handle_ask_unmute(ctx: Context, message: dict) -> None:
    """Hosts can't force someone's mic on (same as Zoom); the participant gets a prompt instead."""
    await manager.send(ctx.code, _target_id(message), {"type": "unmute_request"})


@on("stop_video", role="moderator")
async def handle_stop_video(ctx: Context, message: dict) -> None:
    target_id = _target_id(message)
    with SessionLocal() as db:
        _protect_host(db, ctx, target_id)
        target = participant_service.set_media_state(db, target_id, is_video_off=True)
        await manager.send(ctx.code, target_id, {"type": "force_video_off"})
        await _broadcast_updated(ctx, [target])


@on("ask_start_video", role="moderator")
async def handle_ask_start_video(ctx: Context, message: dict) -> None:
    await manager.send(ctx.code, _target_id(message), {"type": "video_request"})


@on("lower_all_hands", role="moderator")
async def handle_lower_all_hands(ctx: Context, _message: dict) -> None:
    ids = list(ctx.live.raised_hands)
    ctx.live.raised_hands.clear()
    with SessionLocal() as db:
        await _broadcast_updated(ctx, [db.get(Participant, pid) for pid in ids])


@on("lower_hand", role="moderator")
async def handle_lower_hand(ctx: Context, message: dict) -> None:
    target_id = _target_id(message)
    ctx.live.raised_hands.discard(target_id)
    with SessionLocal() as db:
        await _broadcast_updated(ctx, [db.get(Participant, target_id)])


@on("spotlight", role="moderator")
async def handle_spotlight(ctx: Context, message: dict) -> None:
    """Spotlight makes one video the main view for everyone. target_id null removes it."""
    target = message.get("target_id")
    if target is not None and target not in ctx.live.sockets:
        raise NotFoundError("That participant is no longer in the meeting.")
    ctx.live.spotlight_id = target
    await manager.broadcast_all(ctx.code, {"type": "spotlight", "participant_id": target})


@on("set_cohost", role="host")
async def handle_set_cohost(ctx: Context, message: dict) -> None:
    target_id = _target_id(message)
    live = ctx.live
    if target_id not in live.sockets or target_id in live.host_ids:
        raise NotFoundError("That participant is no longer in the meeting.")
    if message.get("value", True):
        live.cohost_ids.add(target_id)
    else:
        live.cohost_ids.discard(target_id)
    with SessionLocal() as db:
        await _broadcast_updated(ctx, [db.get(Participant, target_id)])
    # A new co-host needs the host-only lists
    await manager.send(ctx.code, target_id, {"type": "cohost", "value": target_id in live.cohost_ids})
    await manager.send(ctx.code, target_id, {"type": "waiting_room_updated", "waiting": manager.waiting_list(ctx.code)})


@on("remove_participant", role="moderator")
async def handle_remove(ctx: Context, message: dict) -> None:
    target_id = _target_id(message)
    with SessionLocal() as db:
        _protect_host(db, ctx, target_id)
        participant_service.remove_participant(db, ctx.meeting_id, target_id)
    room_id = await manager.kick(ctx.code, target_id, {"type": "removed"}, CLOSE_REMOVED)
    await manager.broadcast_room(ctx.code, room_id if room_id is not None else MAIN_ROOM, {"type": "participant_left", "participant_id": target_id})


@on("security", role="moderator")
async def handle_security(ctx: Context, message: dict) -> None:
    """Zoom's Security menu: lock meeting, waiting room, and what participants are allowed to do."""
    live = ctx.live
    if "locked" in message:
        live.locked = bool(message["locked"])
    with SessionLocal() as db:
        participant = db.get(Participant, ctx.participant_id)
        meeting = participant.meeting
        for key in ("waiting_room", "allow_chat", "allow_screen_share", "allow_unmute", "allow_rename"):
            if key in message:
                setattr(meeting.settings, key, bool(message[key]))
        db.commit()
        payload = security_payload(meeting, live)
        waiting_off = not meeting.settings.waiting_room
    await manager.broadcast_all(ctx.code, payload)
    # Turning the waiting room off lets everyone who was waiting in, like Zoom.
    if waiting_off and live.waiting:
        await handle_admit_all(ctx, {})


@on("end_meeting", role="host")
async def handle_end_meeting(ctx: Context, _message: dict) -> None:
    with SessionLocal() as db:
        meeting = meeting_service.get_meeting_or_404(db, ctx.code)
        meeting_service.finish_meeting(db, meeting)
    await manager.close_meeting(ctx.code, {"type": "meeting_ended"}, CLOSE_ENDED)


# ---------- Recording ----------

@on("recording", role="moderator")
async def handle_recording(ctx: Context, message: dict) -> None:
    """The recording itself happens in the recorder's browser; everyone is told it's on, as Zoom requires."""
    live = ctx.live
    if message.get("active"):
        live.recording_ids.add(ctx.participant_id)
    else:
        live.recording_ids.discard(ctx.participant_id)
    await manager.broadcast_all(ctx.code, {"type": "recording", "active": bool(live.recording_ids)})


# ---------- Waiting room ----------

async def _admit(ctx: Context, target_id: int) -> None:
    entry = manager.pop_waiting(ctx.code, target_id)
    if entry is None:
        raise NotFoundError("That person is no longer in the waiting room.")
    ctx.live.admitted.add(target_id)
    await enter_room(Context(ctx.code, ctx.meeting_id, target_id, is_host=False), entry.ws)


@on("admit", role="moderator")
async def handle_admit(ctx: Context, message: dict) -> None:
    await _admit(ctx, _target_id(message))
    await notify_hosts_waiting(ctx.code)


@on("admit_all", role="moderator")
async def handle_admit_all(ctx: Context, _message: dict) -> None:
    for person in manager.waiting_list(ctx.code):
        await _admit(ctx, person["id"])
    await notify_hosts_waiting(ctx.code)


@on("deny", role="moderator")
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


# ---------- Polls ----------

def _poll_id(message: dict) -> int:
    poll_id = message.get("poll_id")
    if not isinstance(poll_id, int):
        raise AppError(422, "missing_poll", "poll_id is required.")
    return poll_id


@on("poll_create", role="moderator")
async def handle_poll_create(ctx: Context, message: dict) -> None:
    """{"type": "poll_create", "question": str, "options": [str], "anonymous": bool}. Launches immediately."""
    options = message.get("options") if isinstance(message.get("options"), list) else []
    with SessionLocal() as db:
        poll = poll_service.create_poll(
            db, ctx.meeting_id, ctx.participant_id, str(message.get("question", "")), options, bool(message.get("anonymous"))
        )
        poll_id = poll.id
    await broadcast_poll(ctx.code, ctx.meeting_id, poll_id)


@on("poll_vote")
async def handle_poll_vote(ctx: Context, message: dict) -> None:
    option_id = message.get("option_id")
    if not isinstance(option_id, int):
        raise AppError(422, "missing_option", "option_id is required.")
    with SessionLocal() as db:
        poll_service.vote(db, ctx.meeting_id, _poll_id(message), ctx.participant_id, option_id)
    await broadcast_poll(ctx.code, ctx.meeting_id, _poll_id(message))


@on("poll_end", role="moderator")
async def handle_poll_end(ctx: Context, message: dict) -> None:
    with SessionLocal() as db:
        poll_service.end_poll(db, ctx.meeting_id, _poll_id(message))
    await broadcast_poll(ctx.code, ctx.meeting_id, _poll_id(message))


@on("poll_share", role="moderator")
async def handle_poll_share(ctx: Context, message: dict) -> None:
    with SessionLocal() as db:
        poll_service.share_results(db, ctx.meeting_id, _poll_id(message), bool(message.get("shared", True)))
    await broadcast_poll(ctx.code, ctx.meeting_id, _poll_id(message))


# ---------- Breakout rooms ----------

@on("breakout_open", role="moderator")
async def handle_breakout_open(ctx: Context, message: dict) -> None:
    """{"type": "breakout_open", "rooms": [{"name": str, "participant_ids": [int]}]}. Moves everyone assigned."""
    rooms = message.get("rooms")
    if not isinstance(rooms, list) or not 1 <= len(rooms) <= MAX_BREAKOUT_ROOMS:
        raise AppError(422, "bad_rooms", f"Create between 1 and {MAX_BREAKOUT_ROOMS} rooms.")
    live = ctx.live
    if live.breakout_rooms:
        raise AppError(409, "breakouts_open", "Breakout rooms are already open.")
    assignments = {}
    for index, room in enumerate(rooms, start=1):
        name = str((room or {}).get("name") or f"Room {index}").strip()[:60] or f"Room {index}"
        live.breakout_rooms[index] = name
        for pid in (room or {}).get("participant_ids") or []:
            if isinstance(pid, int) and pid in live.sockets:
                assignments[pid] = index
    for pid, room_id in assignments.items():
        await move_to_room(ctx.code, ctx.meeting_id, pid, room_id)
    await broadcast_breakout_state(ctx.code)


@on("breakout_assign", role="moderator")
async def handle_breakout_assign(ctx: Context, message: dict) -> None:
    """Move one person to a room (0 = main room), e.g. someone who joined after rooms opened."""
    target_id, room_id = _target_id(message), message.get("room_id")
    if room_id != MAIN_ROOM and room_id not in ctx.live.breakout_rooms:
        raise NotFoundError("That breakout room doesn't exist.")
    await move_to_room(ctx.code, ctx.meeting_id, target_id, room_id)
    await broadcast_breakout_state(ctx.code)


@on("breakout_join")
async def handle_breakout_join(ctx: Context, message: dict) -> None:
    """Hosts/co-hosts can visit any room; participants can go back to the main room."""
    room_id = message.get("room_id", MAIN_ROOM)
    if room_id != MAIN_ROOM:
        if not ctx.is_moderator:
            raise AppError(403, "not_host", "Only the host can move you to another room.")
        if room_id not in ctx.live.breakout_rooms:
            raise NotFoundError("That breakout room doesn't exist.")
    await move_to_room(ctx.code, ctx.meeting_id, ctx.participant_id, room_id)
    await broadcast_breakout_state(ctx.code)


@on("breakout_close", role="moderator")
async def handle_breakout_close(ctx: Context, _message: dict) -> None:
    live = ctx.live
    for pid in [p for p in live.sockets if live.room_of(p) != MAIN_ROOM]:
        await move_to_room(ctx.code, ctx.meeting_id, pid, MAIN_ROOM)
    live.breakout_rooms.clear()
    await broadcast_breakout_state(ctx.code)
