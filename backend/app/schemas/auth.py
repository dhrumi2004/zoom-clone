"""Sign up / sign in requests and the response with the session token."""
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, field_validator

from .core import UserOut


class SignupRequest(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    email: EmailStr
    password: Annotated[str, Field(min_length=8, max_length=128)]

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Please enter your name")
        return value

    @field_validator("password")
    @classmethod
    def _strong_enough(cls, value: str) -> str:
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must contain at least one letter and one number")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=1, max_length=128)]


class AuthResponse(BaseModel):
    token: str
    user: UserOut
