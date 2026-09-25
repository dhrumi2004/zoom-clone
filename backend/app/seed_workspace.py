"""Sample data for Team Chat, Mail, Contacts, Docs, Whiteboards, Apps and Settings.

Runs on startup when these tables are empty (also for databases created before these features existed).
"""
import json
from datetime import timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import DEFAULT_USER_EMAIL
from .models import (
    Channel,
    ChannelMember,
    ChannelMessage,
    ChannelType,
    Contact,
    Document,
    Email,
    InstalledApp,
    MailFolder,
    User,
    UserProfile,
    UserSettings,
    Whiteboard,
)
from .utils import utcnow

# email -> (job title, department, phone, location)
PROFILES: Dict[str, Tuple[str, str, str, str]] = {
    DEFAULT_USER_EMAIL: ("Software Engineer", "Engineering", "+91 98765 43210", "Bengaluru, India"),
    "aarav@zoomclone.dev": ("Engineering Manager", "Engineering", "+91 98200 11223", "Mumbai, India"),
    "priya@zoomclone.dev": ("Product Manager", "Product", "+91 99000 33445", "Bengaluru, India"),
    "rohan@zoomclone.dev": ("Frontend Engineer", "Engineering", "+91 98450 55667", "Pune, India"),
    "sneha@zoomclone.dev": ("UX Designer", "Design", "+91 97400 77889", "Chennai, India"),
    "karan@zoomclone.dev": ("QA Engineer", "Engineering", "+91 96000 99001", "Delhi, India"),
}


def seed_workspace_if_empty(db: Session) -> bool:
    me = db.scalar(select(User).where(User.email == DEFAULT_USER_EMAIL))
    if me is None or db.scalar(select(Channel.id).limit(1)) is not None:
        return False
    users = {u.email: u for u in db.scalars(select(User)).all()}
    colleague = lambda key: users[f"{key}@zoomclone.dev"]  # noqa: E731
    now = utcnow()

    for email, (title, dept, phone, location) in PROFILES.items():
        if email in users:
            db.add(UserProfile(user_id=users[email].id, job_title=title, department=dept, phone=phone, location=location))
    db.add(UserSettings(user_id=me.id))
    for u in users.values():
        if u.id != me.id:
            db.add(Contact(owner_id=me.id, contact_id=u.id, is_favorite=u.email in {"priya@zoomclone.dev", "aarav@zoomclone.dev"}))

    _seed_chat(db, me, colleague, now)
    _seed_mail(db, me, colleague, now)
    _seed_docs(db, me, now)
    for key in ("google-drive", "slack"):
        db.add(InstalledApp(user_id=me.id, app_key=key))
    db.commit()
    return True


def _seed_chat(db: Session, me: User, colleague, now) -> None:
    def channel(type_: ChannelType, members: List[User], name: Optional[str] = None, description: Optional[str] = None,
                messages: List[Tuple[User, str, timedelta]] = (), read_until: Optional[timedelta] = None) -> None:
        c = Channel(type=type_, name=name, description=description, created_by=me.id, created_at=now - timedelta(days=30))
        # Messages newer than `read_until` ago stay unread for the signed-in user.
        last_read = now - read_until if read_until else now
        c.members = [ChannelMember(user_id=u.id, joined_at=c.created_at, last_read_at=last_read if u.id == me.id else now) for u in members]
        c.messages = [ChannelMessage(sender_id=u.id, content=text, sent_at=now - ago) for u, text, ago in messages]
        db.add(c)

    everyone = [me, *(colleague(k) for k in ("aarav", "priya", "rohan", "sneha", "karan"))]
    channel(ChannelType.CHANNEL, everyone, "general", "Company-wide announcements and updates", [
        (colleague("aarav"), "Welcome to the team chat, everyone 👋", timedelta(days=3)),
        (colleague("priya"), "Reminder: roadmap review is on Friday. Please add your items to the doc.", timedelta(days=1, hours=2)),
        (me, "Thanks Priya, I'll add the meeting features update.", timedelta(days=1, hours=1)),
        (colleague("karan"), "Bug bash results are in the QA channel doc, great job all!", timedelta(hours=3)),
    ], read_until=timedelta(hours=4))
    channel(ChannelType.CHANNEL, [me, colleague("sneha"), colleague("priya")], "design-team", "Design reviews and feedback", [
        (colleague("sneha"), "Uploaded the new dashboard mockups 🎨", timedelta(days=2)),
        (colleague("priya"), "These look great. Can we try the calendar card on the right?", timedelta(days=2, hours=-1)),
        (colleague("sneha"), "Sure, updated version is in the Figma file.", timedelta(hours=20)),
    ])
    channel(ChannelType.CHANNEL, [me, colleague("aarav"), colleague("rohan"), colleague("karan")], "engineering", "Engineering discussions", [
        (colleague("rohan"), "PR for the meeting toolbar is ready for review.", timedelta(hours=6)),
        (colleague("aarav"), "Nice. Let's merge after QA signs off.", timedelta(hours=5)),
        (colleague("karan"), "Testing now, screen share works on Chrome and Safari ✅", timedelta(hours=1)),
    ], read_until=timedelta(hours=2))
    channel(ChannelType.DIRECT, [me, colleague("priya")], messages=[
        (colleague("priya"), "Hey! Do you have 10 minutes today to go over the demo?", timedelta(hours=2)),
        (me, "Sure, how about 4 PM?", timedelta(hours=1, minutes=50)),
        (colleague("priya"), "Perfect, I'll send an invite 👍", timedelta(minutes=30)),
    ], read_until=timedelta(minutes=40))
    channel(ChannelType.DIRECT, [me, colleague("rohan")], messages=[
        (colleague("rohan"), "Can you check my comments on the WebRTC PR?", timedelta(days=1)),
        (me, "Done, left a couple of suggestions.", timedelta(hours=22)),
    ])


def _seed_mail(db: Session, me: User, colleague, now) -> None:
    def inbox(sender_name: str, sender_email: str, subject: str, body: str, ago: timedelta, read=False, starred=False):
        db.add(Email(owner_id=me.id, folder=MailFolder.INBOX, from_name=sender_name, from_email=sender_email,
                     to_emails=me.email, subject=subject, body=body, is_read=read, is_starred=starred, sent_at=now - ago))

    def person(key: str) -> Tuple[str, str]:
        u = colleague(key)
        return u.name, u.email

    inbox(*person("priya"), "Q4 roadmap review: agenda",
          f"Hi {me.name.split()[0]},\n\nHere's the agenda for Friday's roadmap review:\n\n1. Meeting features update\n2. Calendar integration\n3. Mobile layout\n\nPlease add anything I missed.\n\nThanks,\nPriya",
          timedelta(hours=1), starred=True)
    inbox(*person("sneha"), "New dashboard mockups ready for feedback",
          "Hi team,\n\nThe updated dashboard and meeting room mockups are ready. I'd love your feedback by Thursday.\n\nSneha",
          timedelta(hours=5))
    inbox(*person("aarav"), "Sprint 24 planning notes",
          "Hi all,\n\nNotes from today's planning:\n- Waiting room: done\n- Host controls: done\n- Deploy to staging: this week\n\nAarav",
          timedelta(days=1), read=True)
    inbox(*person("karan"), "Bug bash results",
          "Hi,\n\nWe found 12 issues, 10 are fixed already. The remaining two are cosmetic. Details in the shared doc.\n\nKaran",
          timedelta(days=2), read=True)
    inbox(*person("rohan"), "Code review: meeting room toolbar",
          "Hey,\n\nThanks for the review. I've addressed your comments; the popovers no longer get clipped.\n\nRohan",
          timedelta(days=3), read=True)
    inbox("Zoom", "no-reply@zoom.us", "Welcome to Zoom Workplace",
          "Welcome!\n\nYour account is ready. Start a meeting, chat with your team, and keep everything in one place.\n\nThe Zoom Team",
          timedelta(days=7), read=True)

    for key, subject, body, ago in [
        ("priya", "Re: Demo prep", "Sounds good, see you at 4 PM.", timedelta(hours=3)),
        ("aarav", "Meeting features status", "Hi Aarav,\n\nAll core meeting features are working. Deployment is next.\n\nThanks", timedelta(days=1, hours=3)),
    ]:
        u = colleague(key)
        db.add(Email(owner_id=me.id, folder=MailFolder.SENT, from_name=me.name, from_email=me.email, to_emails=u.email,
                     subject=subject, body=body, is_read=True, sent_at=now - ago))


def _seed_docs(db: Session, me: User, now) -> None:
    docs = [
        ("Q4 Product Roadmap", "<h1>Q4 Product Roadmap</h1><p>Goals for the quarter:</p><ul><li>Ship waiting room and host controls</li><li>Calendar view for meetings</li><li>Improve mobile layout</li></ul><h2>Timeline</h2><ol><li>October: meetings polish</li><li>November: workspace apps</li><li>December: performance</li></ol>", timedelta(days=2)),
        ("Meeting Notes: Weekly Team Sync", "<h2>Attendees</h2><p>Aarav, Priya, Rohan, Sneha, Karan</p><h2>Action items</h2><ul><li><b>Rohan</b>: finish toolbar PR</li><li><b>Sneha</b>: share updated mockups</li><li><b>Karan</b>: run regression tests</li></ul>", timedelta(days=1)),
        ("Onboarding Checklist", "<h1>Welcome aboard!</h1><ul><li>Set up your profile picture</li><li>Join the <i>#general</i> channel</li><li>Schedule a 1:1 with your manager</li></ul>", timedelta(days=6)),
    ]
    for title, html, ago in docs:
        db.add(Document(owner_id=me.id, title=title, content=html, created_at=now - ago, updated_at=now - ago))

    # A small sketch: two boxes joined by an arrow ("Frontend -> Backend")
    def rect(x, y, w, h):
        return [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]
    strokes = [
        {"tool": "pen", "color": "#0b5cff", "size": 4, "points": rect(80, 100, 220, 120)},
        {"tool": "pen", "color": "#ff742e", "size": 4, "points": rect(480, 100, 220, 120)},
        {"tool": "pen", "color": "#232333", "size": 3, "points": [[300, 160], [480, 160]]},
        {"tool": "pen", "color": "#232333", "size": 3, "points": [[460, 145], [480, 160], [460, 175]]},
    ]
    db.add(Whiteboard(owner_id=me.id, title="Architecture sketch", data=json.dumps(strokes), created_at=now - timedelta(days=1), updated_at=now - timedelta(days=1)))
    db.add(Whiteboard(owner_id=me.id, title="Sprint retro", data="[]", created_at=now - timedelta(days=4), updated_at=now - timedelta(days=4)))
