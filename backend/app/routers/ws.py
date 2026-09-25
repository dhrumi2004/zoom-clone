"""Live meeting connection: ws://<host>/ws/meetings/{code}?participant_id=<id>

Flow: the client first calls POST /api/meetings/{code}/join (REST) to get a participant id,
then opens this socket. Closing the socket counts as leaving the meeting.
If the meeting has a waiting room, guests wait until the host admits them.

Server -> client message types:
  room_state, participant_joined, participant_left, participant_updated, signal, chat,
  reaction, screen_share, force_mute, unmute_request, removed, meeting_ended, error,
  waiting_room (you are waiting), waiting_room_updated (hosts: who is waiting)
"""
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..database import SessionLocal
from ..exceptions import AppError
from ..models import ParticipantRole
from ..realtime.handlers import dispatch
from ..realtime.manager import CLOSE_INVALID, CLOSE_REPLACED, manager
from ..realtime.session import Context, enter_room, notify_hosts_waiting
from ..services import meetings as meeting_service
from ..services import participants as participant_service

router = APIRouter(tags=["realtime"])


def _error(exc: AppError) -> dict:
    return {"type": "error", "code": exc.code, "detail": exc.message}


@router.websocket("/ws/meetings/{code}")
async def meeting_socket(ws: WebSocket, code: str, participant_id: int) -> None:
    await ws.accept()

    with SessionLocal() as db:
        try:
            participant = participant_service.get_active_participant(db, code, participant_id)
        except AppError as exc:
            await ws.send_json(_error(exc))
            await ws.close(code=CLOSE_INVALID)
            return

        meeting = participant.meeting
        ctx = Context(
            code=meeting.meeting_code,
            meeting_id=meeting.id,
            participant_id=participant.id,
            is_host=participant.role == ParticipantRole.HOST,
        )
        room = manager.get_room(ctx.code)
        must_wait = meeting.settings.waiting_room and not ctx.is_host and participant.id not in room.admitted
        title, name = meeting.title, participant.display_name

    if must_wait:
        previous = manager.add_waiting(ctx.code, ctx.participant_id, ws, name)
        if previous is not None:
            await previous.close(code=CLOSE_REPLACED)
        await ws.send_json({"type": "waiting_room", "title": title})
        await notify_hosts_waiting(ctx.code)
    else:
        await enter_room(ctx, ws)

    try:
        while True:
            raw = await ws.receive_text()
            if not manager.is_in_room(ctx.code, ctx.participant_id, ws):
                continue  # still in the waiting room: nothing to do until admitted
            try:
                message = json.loads(raw)
                if not isinstance(message, dict):
                    raise ValueError
                await dispatch(ctx, message)
            except AppError as exc:
                await ws.send_json(_error(exc))
            except ValueError:
                await ws.send_json({"type": "error", "code": "bad_json", "detail": "Messages must be JSON objects."})
    except WebSocketDisconnect:
        pass  # the client closed the connection
    except RuntimeError:
        pass  # the server closed it (removed / meeting ended / replaced) while we were waiting to receive
    finally:
        await _handle_disconnect(ctx, ws)


def _leave(ctx: Context) -> None:
    with SessionLocal() as db:
        try:
            meeting_service.leave_meeting(db, ctx.code, ctx.participant_id)
        except AppError:
            pass  # the meeting was deleted meanwhile


async def _handle_disconnect(ctx: Context, ws: WebSocket) -> None:
    # Left while still in the waiting room
    if manager.remove_waiting(ctx.code, ctx.participant_id, ws):
        _leave(ctx)
        await notify_hosts_waiting(ctx.code)
        return

    room = manager.find_room(ctx.code)
    was_sharing = room is not None and room.screen_sharer_id == ctx.participant_id
    # False when this socket was replaced by a new tab, kicked, or the room was closed: nothing left to clean up.
    if not manager.disconnect(ctx.code, ctx.participant_id, ws):
        return

    _leave(ctx)
    if was_sharing:
        await manager.broadcast(ctx.code, {"type": "screen_share", "participant_id": ctx.participant_id, "active": False})
    await manager.broadcast(ctx.code, {"type": "participant_left", "participant_id": ctx.participant_id})
