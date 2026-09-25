"""Zoom Workplace tables beyond meetings: profile/settings, contacts, team chat, mail, docs, whiteboards, apps.

users 1──1 user_profiles, 1──1 user_settings
users 1──* contacts *──1 users                       (owner -> contact)
channels 1──* channel_members *──1 users             (DMs are channels with type=direct and 2 members)
channels 1──* channel_messages *──1 users
users 1──* emails / documents / whiteboards / installed_apps
"""
import enum
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from ..utils import utcnow
from .core import User, _str_enum


class UserProfile(Base):
    """Directory details shown in Contacts. 1:1 with users so `users` stays small."""

    __tablename__ = "user_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    user: Mapped["User"] = relationship()


class UserSettings(Base):
    """Personal defaults used by the app (Settings page)."""

    __tablename__ = "user_settings"
    __table_args__ = (CheckConstraint("default_duration_min BETWEEN 15 AND 1440", name="ck_settings_duration"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    start_with_video: Mapped[bool] = mapped_column(Boolean, default=True)
    mute_on_join: Mapped[bool] = mapped_column(Boolean, default=False)
    default_duration_min: Mapped[int] = mapped_column(Integer, default=60)
    default_waiting_room: Mapped[bool] = mapped_column(Boolean, default=False)
    default_mute_on_entry: Mapped[bool] = mapped_column(Boolean, default=False)


class Contact(Base):
    __tablename__ = "contacts"
    __table_args__ = (
        UniqueConstraint("owner_id", "contact_id", name="uq_contacts_owner_contact"),
        CheckConstraint("owner_id <> contact_id", name="ck_contacts_not_self"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    contact_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    contact: Mapped["User"] = relationship(foreign_keys=[contact_id])


# ---------- Team Chat ----------

class ChannelType(str, enum.Enum):
    CHANNEL = "channel"
    DIRECT = "direct"


class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[ChannelType] = mapped_column(_str_enum(ChannelType))
    # NULL for direct messages (the other person's name is shown instead)
    name: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    members: Mapped[List["ChannelMember"]] = relationship(back_populates="channel", cascade="all, delete-orphan")
    messages: Mapped[List["ChannelMessage"]] = relationship(
        back_populates="channel", cascade="all, delete-orphan", order_by="ChannelMessage.sent_at"
    )


class ChannelMember(Base):
    __tablename__ = "channel_members"

    channel_id: Mapped[int] = mapped_column(ForeignKey("channels.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    # Messages after this time count as unread
    last_read_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    channel: Mapped["Channel"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()


class ChannelMessage(Base):
    __tablename__ = "channel_messages"
    __table_args__ = (Index("ix_channel_messages_channel_sent", "channel_id", "sent_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    channel_id: Mapped[int] = mapped_column(ForeignKey("channels.id", ondelete="CASCADE"))
    sender_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    channel: Mapped["Channel"] = relationship(back_populates="messages")
    sender: Mapped[Optional["User"]] = relationship()


# ---------- Mail ----------

class MailFolder(str, enum.Enum):
    INBOX = "inbox"
    SENT = "sent"
    TRASH = "trash"


class Email(Base):
    """One row per mailbox copy (the owner's view of a message)."""

    __tablename__ = "emails"
    __table_args__ = (Index("ix_emails_owner_folder_sent", "owner_id", "folder", "sent_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    folder: Mapped[MailFolder] = mapped_column(_str_enum(MailFolder), default=MailFolder.INBOX)
    # Where a trashed message came from, so "Restore" puts it back
    original_folder: Mapped[Optional[MailFolder]] = mapped_column(_str_enum(MailFolder), nullable=True)
    from_name: Mapped[str] = mapped_column(String(100))
    from_email: Mapped[str] = mapped_column(String(255))
    to_emails: Mapped[str] = mapped_column(Text)  # comma-separated
    subject: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ---------- Docs & Whiteboards ----------

class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (Index("ix_documents_owner_updated", "owner_id", "updated_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text, default="")  # sanitized HTML
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Whiteboard(Base):
    __tablename__ = "whiteboards"
    __table_args__ = (Index("ix_whiteboards_owner_updated", "owner_id", "updated_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    # JSON list of strokes: [{"color": "#000", "size": 4, "tool": "pen", "points": [[x, y], ...]}]
    data: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


# ---------- Apps ----------

class InstalledApp(Base):
    """Which marketplace apps a user added. The catalog itself is static (services/apps.py)."""

    __tablename__ = "installed_apps"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    app_key: Mapped[str] = mapped_column(String(50), primary_key=True)
    installed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
