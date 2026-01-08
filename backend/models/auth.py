"""Authentication models."""
from pydantic import BaseModel
from typing import Optional, List, Union


class UserLogin(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    access: Union[str, List[str]]  # 'balia', 'sauna', 'logistics', 'driver', 'warehouse', 'all' or list like ['balia', 'logistics']
    role: str = "employee"  # 'admin', 'employee', 'observer', 'driver' or 'warehouse'


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    access: Optional[Union[str, List[str]]] = None
    role: Optional[str] = None  # 'admin', 'employee', 'observer', 'driver' or 'warehouse'


class UserResponse(BaseModel):
    id: str
    username: str
    role: str  # 'admin', 'employee', 'observer', 'driver' or 'warehouse'
    access: Union[str, List[str]]  # 'balia', 'sauna', 'logistics', 'driver', 'warehouse', 'all' or list
    createdAt: str


class TokenResponse(BaseModel):
    token: str
    user: UserResponse
