"""Authentication routes."""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
import uuid
from datetime import datetime, timezone

from database import db
from models.auth import UserLogin, UserCreate, UserUpdate, UserResponse, TokenResponse
from services.auth_service import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
    get_admin_user,
    init_admin_user
)

router = APIRouter(tags=["Authentication"])

import logging
logger = logging.getLogger(__name__)


@router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login user (admin or employee)"""
    logger.info(f"Login attempt for user: {credentials.username}")
    
    # Note: init_admin_user is now called only at startup, not on every login
    
    try:
        user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    except Exception as e:
        logger.error(f"Database error during login for {credentials.username}: {e}")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable")
    
    if not user:
        logger.warning(f"Login failed: user '{credentials.username}' not found")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user["password"]):
        logger.warning(f"Login failed: wrong password for user '{credentials.username}'")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user)
    logger.info(f"Login successful for user: {credentials.username}")
    
    user_response = UserResponse(
        id=user["id"],
        username=user["username"],
        role=user["role"],
        access=user["access"],
        createdAt=user["createdAt"]
    )
    return TokenResponse(token=token, user=user_response)


@router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current logged in user info"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)


@router.post("/auth/verify")
async def verify_token(current_user: dict = Depends(get_current_user)):
    """Verify if token is valid"""
    logger.info(f"Token verified for user: {current_user.get('sub', 'unknown')}")
    return {"valid": True, "user": current_user}


@router.get("/users", response_model=List[UserResponse])
async def get_users(admin: dict = Depends(get_admin_user)):
    """Get all users (admin only)"""
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return [UserResponse(**user) for user in users]


@router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, admin: dict = Depends(get_admin_user)):
    """Create a new employee, observer, driver or admin (admin only)"""
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Validate access - can be string or array
    valid_access_values = ["balia", "sauna", "logistics", "driver", "warehouse", "sauna_crm", "sauna_production", "training", "all"]
    if isinstance(user_data.access, list):
        for acc in user_data.access:
            if acc not in valid_access_values:
                raise HTTPException(status_code=400, detail=f"Invalid access value: {acc}. Must be one of: {valid_access_values}")
    elif user_data.access not in valid_access_values:
        raise HTTPException(status_code=400, detail=f"Access must be one of: {valid_access_values}")
    
    if user_data.role not in ["admin", "employee", "observer", "driver", "warehouse"]:
        raise HTTPException(status_code=400, detail="Role must be 'admin', 'employee', 'observer', 'driver' or 'warehouse'")
    
    # Only super-admin (username: 'admin') can create users with 'admin' role
    if user_data.role == "admin" and admin.get("username") != "admin":
        raise HTTPException(status_code=403, detail="Only super-admin can assign admin role")
    
    new_user = {
        "id": str(uuid.uuid4()),
        "username": user_data.username,
        "password": hash_password(user_data.password),
        "role": user_data.role,
        "access": user_data.access,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_user)
    
    return UserResponse(
        id=new_user["id"],
        username=new_user["username"],
        role=new_user["role"],
        access=new_user["access"],
        createdAt=new_user["createdAt"]
    )


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, admin: dict = Depends(get_admin_user)):
    """Update an employee or observer (admin only)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Only super-admin can edit users with admin role
    if user.get("role") == "admin" and admin.get("username") != "admin":
        raise HTTPException(status_code=403, detail="Only super-admin can edit admin users")
    
    # Prevent editing the super-admin account itself (except by super-admin)
    if user.get("username") == "admin" and admin.get("username") != "admin":
        raise HTTPException(status_code=403, detail="Cannot edit super-admin account")
    
    update_data = {}
    if user_data.username:
        existing = await db.users.find_one({"username": user_data.username, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
        update_data["username"] = user_data.username
    
    if user_data.password:
        update_data["password"] = hash_password(user_data.password)
    
    if user_data.access:
        # Validate access - can be string or array
        valid_access_values = ["balia", "sauna", "logistics", "driver", "warehouse", "sauna_crm", "sauna_production", "training", "all"]
        if isinstance(user_data.access, list):
            for acc in user_data.access:
                if acc not in valid_access_values:
                    raise HTTPException(status_code=400, detail=f"Invalid access value: {acc}. Must be one of: {valid_access_values}")
        elif user_data.access not in valid_access_values:
            raise HTTPException(status_code=400, detail=f"Access must be one of: {valid_access_values}")
        update_data["access"] = user_data.access
    
    if user_data.role:
        if user_data.role not in ["admin", "employee", "observer", "driver", "warehouse"]:
            raise HTTPException(status_code=400, detail="Role must be 'admin', 'employee', 'observer', 'driver' or 'warehouse'")
        # Only super-admin can assign admin role
        if user_data.role == "admin" and admin.get("username") != "admin":
            raise HTTPException(status_code=403, detail="Only super-admin can assign admin role")
        update_data["role"] = user_data.role
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return UserResponse(**updated_user)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a user (admin only). Super-admin can delete anyone except themselves."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot delete super-admin account
    if user.get("username") == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete super-admin account")
    
    # Only super-admin can delete other admins
    if user.get("role") == "admin" and admin.get("username") != "admin":
        raise HTTPException(status_code=403, detail="Only super-admin can delete admin users")
    
    await db.users.delete_one({"id": user_id})
    return {"message": "User deleted successfully"}
