"""Team Chat: channels and direct messages. A DM is a channel of type 'direct' with exactly two members."""
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..exceptions import AppError, NotFoundError
from ..models import Channel, ChannelMember, ChannelMessage, ChannelType, User
from ..schemas.workspace import ChannelCreate
from ..utils import utcnow


def _member_out(user: User) -> dict:
    return {"id": user.id, "name": user.name, "avatar_color": user.avatar_color}


def _channel_out(db: Session, channel: Channel, me: User) -> dict:
    membership = next(m for m in channel.members if m.user_id == me.id)
    unread = db.scalar(
        select(func.count(ChannelMessage.id)).where(
            ChannelMessage.channel_id == channel.id,
            ChannelMessage.sent_at > membership.last_read_at,
            ChannelMessage.sender_id != me.id,
        )
    )
    last = db.scalar(
        select(ChannelMessage).where(ChannelMessage.channel_id == channel.id).order_by(ChannelMessage.sent_at.desc()).limit(1)
    )
    others = [m.user for m in channel.members if m.user_id != me.id]
    name = channel.name if channel.type == ChannelType.CHANNEL else (others[0].name if others else me.name)
    return {
        "id": channel.id,
        "type": channel.type,
        "name": name,
        "description": channel.description,
        "members": [_member_out(m.user) for m in channel.members],
        "unread_count": unread or 0,
        "last_message": last.content if last else None,
        "last_message_at": last.sent_at if last else None,
    }


def _my_channel(db: Session, me: User, channel_id: int) -> Channel:
    channel = db.scalar(
        select(Channel)
        .where(Channel.id == channel_id)
        .options(selectinload(Channel.members).selectinload(ChannelMember.user))
    )
    if channel is None or all(m.user_id != me.id for m in channel.members):
        raise NotFoundError("Conversation not found.")
    return channel


def list_channels(db: Session, me: User) -> List[dict]:
    channels = db.scalars(
        select(Channel)
        .join(ChannelMember, ChannelMember.channel_id == Channel.id)
        .where(ChannelMember.user_id == me.id)
        .options(selectinload(Channel.members).selectinload(ChannelMember.user))
    ).all()
    result = [_channel_out(db, c, me) for c in channels]
    # Most recent activity first
    return sorted(result, key=lambda c: c["last_message_at"] or utcnow().replace(year=2000), reverse=True)


def create_channel(db: Session, me: User, data: ChannelCreate) -> dict:
    member_ids = {me.id, *data.member_ids}
    users = db.scalars(select(User).where(User.id.in_(member_ids))).all()
    if len(users) != len(member_ids):
        raise AppError(422, "unknown_member", "One of the selected people doesn't exist.")
    channel = Channel(type=ChannelType.CHANNEL, name=data.name, description=data.description, created_by=me.id)
    channel.members = [ChannelMember(user_id=u.id) for u in users]
    db.add(channel)
    db.commit()
    return _channel_out(db, _my_channel(db, me, channel.id), me)


def get_or_create_direct(db: Session, me: User, other_id: int) -> dict:
    other = db.get(User, other_id)
    if other is None or other.id == me.id:
        raise NotFoundError("Person not found.")
    mine = select(ChannelMember.channel_id).where(ChannelMember.user_id == me.id)
    theirs = select(ChannelMember.channel_id).where(ChannelMember.user_id == other.id)
    existing: Optional[int] = db.scalar(
        select(Channel.id).where(Channel.type == ChannelType.DIRECT, Channel.id.in_(mine), Channel.id.in_(theirs))
    )
    if existing is None:
        channel = Channel(type=ChannelType.DIRECT, created_by=me.id)
        channel.members = [ChannelMember(user_id=me.id), ChannelMember(user_id=other.id)]
        db.add(channel)
        db.commit()
        existing = channel.id
    return _channel_out(db, _my_channel(db, me, existing), me)


def _message_out(message: ChannelMessage) -> dict:
    return {
        "id": message.id,
        "channel_id": message.channel_id,
        "sender": _member_out(message.sender) if message.sender else None,
        "content": message.content,
        "sent_at": message.sent_at,
    }


def list_messages(db: Session, me: User, channel_id: int) -> List[dict]:
    """Returns the conversation and marks it as read."""
    channel = _my_channel(db, me, channel_id)
    messages = db.scalars(
        select(ChannelMessage)
        .where(ChannelMessage.channel_id == channel.id)
        .order_by(ChannelMessage.sent_at)
        .options(selectinload(ChannelMessage.sender))
    ).all()
    membership = next(m for m in channel.members if m.user_id == me.id)
    membership.last_read_at = utcnow()
    db.commit()
    return [_message_out(m) for m in messages]


def send_message(db: Session, me: User, channel_id: int, content: str) -> dict:
    channel = _my_channel(db, me, channel_id)
    message = ChannelMessage(channel_id=channel.id, sender_id=me.id, content=content)
    db.add(message)
    next(m for m in channel.members if m.user_id == me.id).last_read_at = utcnow()
    db.commit()
    db.refresh(message)
    return _message_out(message)


def unread_total(db: Session, me: User) -> int:
    return sum(c["unread_count"] for c in list_channels(db, me))
