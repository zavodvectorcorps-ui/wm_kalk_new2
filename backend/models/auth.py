"""Authentication models."""
from pydantic import BaseModel
from typing import Optional


class UserLogin(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    access: str  # 'balia', 'sauna', or 'all'
    role: str = "employee"  # 'admin', 'employee' or 'observer'


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    access: Optional[str] = None
    role: Optional[str] = None  # 'admin', 'employee' or 'observer'


class UserResponse(BaseModel):
    id: str
    username: str
    role: str  # 'admin', 'employee', or 'observer'
    access: str  # 'balia', 'sauna', or 'all'
    createdAt: str


class TokenResponse(BaseModel):
    token: str
    user: UserResponse
