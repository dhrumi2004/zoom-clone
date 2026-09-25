from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user, get_token
from ..models import User
from ..schemas.auth import AuthResponse, LoginRequest, SignupRequest
from ..services import auth as service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(data: SignupRequest, db: Session = Depends(get_db)) -> dict:
    user, token = service.signup(db, data.name, data.email, data.password)
    return {"token": token, "user": user}


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)) -> dict:
    user, token = service.login(db, data.email, data.password)
    return {"token": token, "user": user}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    _user: User = Depends(get_current_user), token: str = Depends(get_token), db: Session = Depends(get_db)
) -> Response:
    service.logout(db, token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
