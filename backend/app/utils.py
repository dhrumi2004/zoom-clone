"""Small helpers with no database access."""
import secrets
import string
from datetime import datetime, timezone

# Zoom-like avatar background colors
AVATAR_COLORS = ["#0E72ED", "#8B5CF6", "#F97316", "#10B981", "#EF4444", "#EAB308", "#EC4899", "#14B8A6"]


def utcnow() -> datetime:
    """Current time in UTC, stored naive (SQLite has no timezone support). All DB times are UTC."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def generate_numeric_code(length: int = 10) -> str:
    """Random digit string that never starts with 0, e.g. '8347261905'."""
    first = secrets.choice("123456789")
    rest = "".join(secrets.choice(string.digits) for _ in range(length - 1))
    return first + rest


def generate_passcode(length: int = 6) -> str:
    """Random alphanumeric passcode, e.g. 'a8Kd2q'."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def random_avatar_color() -> str:
    return secrets.choice(AVATAR_COLORS)
