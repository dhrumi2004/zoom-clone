"""FastAPI entry point. Run with:  uvicorn app.main:app --reload"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (registers tables on Base.metadata)
from .config import CORS_ORIGIN_REGEX, CORS_ORIGINS
from .database import Base, SessionLocal, engine
from .exceptions import register_exception_handlers
from .routers import meetings, users, ws
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Create tables and seed sample data on first run (also covers fresh deploys).
    Base.metadata.create_all(bind=engine)
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
app.include_router(users.router)
app.include_router(meetings.router)
app.include_router(ws.router)


@app.get("/health", tags=["system"])
def health() -> dict:
    return {"status": "ok"}
