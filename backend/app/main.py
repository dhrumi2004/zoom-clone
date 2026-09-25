"""FastAPI entry point. Run with:  uvicorn app.main:app --reload"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (registers tables on Base.metadata)
from .config import CORS_ORIGIN_REGEX, CORS_ORIGINS
from .database import Base, SessionLocal, engine
from .exceptions import register_exception_handlers
from .migrations import upgrade as upgrade_schema
from .routers import apps, auth, contacts, documents, mail, meetings, team_chat, users, ws
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Create tables and seed sample data on first run (also covers fresh deploys).
    Base.metadata.create_all(bind=engine)
    upgrade_schema(engine)  # add columns introduced after a database was first created
    with SessionLocal() as db:
        seed_if_empty(db)
    yield


app = FastAPI(title="Zoom Clone API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(meetings.router)
app.include_router(ws.router)
app.include_router(contacts.router)
app.include_router(team_chat.router)
app.include_router(mail.router)
app.include_router(documents.docs)
app.include_router(documents.boards)
app.include_router(apps.router)


@app.get("/health", tags=["system"])
def health() -> dict:
    return {"status": "ok"}
