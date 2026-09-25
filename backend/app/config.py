"""App settings. Values can be overridden with environment variables in production."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'zoom_clone.db'}")

# Used to build shareable invite links (e.g. http://localhost:3000/j/1234567890?pwd=abc123)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

# Browsers treat localhost and 127.0.0.1 as different sites, so allow both in development.
_DEFAULT_ORIGINS = f"{FRONTEND_URL},http://localhost:3000,http://127.0.0.1:3000"
CORS_ORIGINS = sorted({
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ORIGINS", _DEFAULT_ORIGINS).split(",")
    if origin.strip()
})

# Optional regex for extra origins, e.g. every Vercel preview deploy: https://.*\.vercel\.app
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX") or None

# The seeded demo account that owns the sample meetings, chats, mail and docs.
DEFAULT_USER_EMAIL = "dhrumi@zoomclone.dev"
DEFAULT_USER_NAME = "Dhrumi Upadhyay"

# Password of every seeded demo account (shown on the sign-in page so reviewers can try it).
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "zoom1234")

# How long a sign-in lasts before the user must sign in again.
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "30"))
