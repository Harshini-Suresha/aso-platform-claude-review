"""
Lightweight auth: SHA-256 password hashing + JWT tokens.
No heavy dependencies (bcrypt/passlib) required.
"""

from __future__ import annotations

import hashlib
import os
import time
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User

SECRET_KEY = os.environ.get("ASO_PLATFORM_JWT_SECRET", "aso-platform-dev-secret-change-in-prod")
TOKEN_EXPIRY = 7 * 24 * 3600  # 7 days

_bearer = HTTPBearer(auto_error=False)


def _salt() -> str:
    return os.environ.get("ASO_PLATFORM_PASSWORD_SALT", "aso-platform-default-salt")


def hash_password(password: str) -> str:
    return hashlib.sha256(f"{_salt()}{password}".encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def create_token(user_id: int) -> str:
    payload = {"uid": user_id, "exp": time.time() + TOKEN_EXPIRY}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        if payload.get("exp", 0) < time.time():
            return None
        return payload.get("uid")
    except (jwt.InvalidTokenError, KeyError):
        return None


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = decode_token(creds.credentials)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
