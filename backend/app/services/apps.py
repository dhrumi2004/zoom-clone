"""Apps marketplace. The catalog is static; installs are stored per user."""
from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..exceptions import NotFoundError
from ..models import InstalledApp, User

CATALOG = [
    {"key": "google-drive", "name": "Google Drive", "developer": "Google", "category": "Productivity", "color": "#1FA463", "description": "Share and open Drive files right from your meetings and chats."},
    {"key": "slack", "name": "Slack", "developer": "Slack Technologies", "category": "Collaboration", "color": "#4A154B", "description": "Start a Zoom meeting from any Slack channel with /zoom."},
    {"key": "jira", "name": "Jira Cloud", "developer": "Atlassian", "category": "Productivity", "color": "#0052CC", "description": "Create and update Jira issues without leaving your meeting."},
    {"key": "miro", "name": "Miro", "developer": "Miro", "category": "Collaboration", "color": "#FFD02F", "description": "Brainstorm together on an infinite online whiteboard."},
    {"key": "asana", "name": "Asana", "developer": "Asana", "category": "Productivity", "color": "#F06A6A", "description": "Turn meeting action items into Asana tasks."},
    {"key": "trello", "name": "Trello", "developer": "Atlassian", "category": "Productivity", "color": "#0079BF", "description": "Bring your boards into meetings and keep everyone on track."},
    {"key": "kahoot", "name": "Kahoot!", "developer": "Kahoot!", "category": "Education", "color": "#46178F", "description": "Host live quizzes and polls during class or team meetings."},
    {"key": "otter", "name": "Otter.ai", "developer": "Otter.ai", "category": "Productivity", "color": "#2E6BE6", "description": "Live transcripts and automatic meeting notes."},
    {"key": "hubspot", "name": "HubSpot", "developer": "HubSpot", "category": "Sales", "color": "#FF7A59", "description": "Log meetings and calls to HubSpot contacts automatically."},
    {"key": "salesforce", "name": "Salesforce", "developer": "Salesforce", "category": "Sales", "color": "#00A1E0", "description": "Schedule meetings from Salesforce records and sync activity."},
    {"key": "headspace", "name": "Headspace", "developer": "Headspace", "category": "Wellness", "color": "#F47D31", "description": "Guided breathing breaks between back-to-back meetings."},
    {"key": "polly", "name": "Polly", "developer": "Polly", "category": "Collaboration", "color": "#6C5CE7", "description": "Run quick polls and surveys to engage participants."},
]
_KEYS = {app["key"] for app in CATALOG}


def list_apps(db: Session, me: User) -> List[dict]:
    installed = set(db.scalars(select(InstalledApp.app_key).where(InstalledApp.user_id == me.id)).all())
    return [{**app, "installed": app["key"] in installed} for app in CATALOG]


def set_installed(db: Session, me: User, key: str, installed: bool) -> dict:
    if key not in _KEYS:
        raise NotFoundError("App not found.")
    row = db.get(InstalledApp, (me.id, key))
    if installed and row is None:
        db.add(InstalledApp(user_id=me.id, app_key=key))
    elif not installed and row is not None:
        db.delete(row)
    db.commit()
    return next({**a, "installed": installed} for a in CATALOG if a["key"] == key)
