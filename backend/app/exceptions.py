"""Domain errors raised by services and turned into JSON responses by one handler."""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """`code` is a stable machine-readable string the frontend can switch on."""

    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message


class NotFoundError(AppError):
    def __init__(self, message: str = "Not found"):
        super().__init__(404, "not_found", message)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "detail": exc.message})
