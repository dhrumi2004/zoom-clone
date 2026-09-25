from fastapi import APIRouter, Depends

from ..dependencies import get_current_user
from ..models import User
from ..schemas import UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)) -> User:
    return user
