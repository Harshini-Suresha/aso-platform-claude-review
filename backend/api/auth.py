"""
Auth endpoints: signup, login, email verification, get current user.
"""

from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, VerificationToken, Project
from services.auth_service import hash_password, verify_password, create_token, get_current_user
from services.email_service import generate_verification_token, send_verification_email

router = APIRouter()

_VERIFICATION_TOKEN_EXPIRY = 24 * 3600  # 24 hours


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyRequest(BaseModel):
    token: str


def _user_dict(user: User, token: str) -> dict:
    initials = ""
    if user.name:
        parts = user.name.strip().split()
        initials = "".join(p[0].upper() for p in parts[:2])
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "institution": user.institution,
        "department": user.department,
        "bio": user.bio,
        "initials": initials,
        "verified": bool(user.verified),
        "token": token,
    }


@router.post("/api/auth/signup")
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    existing = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        email=req.email.lower().strip(),
        name=req.name.strip(),
        password_hash=hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create verification token and send email
    raw_token = generate_verification_token()
    vt = VerificationToken(user_id=user.id, token=raw_token)
    db.add(vt)
    db.commit()

    email_sent = send_verification_email(user.email, user.name, raw_token)

    token = create_token(user.id)

    now = time.time()
    default_project = Project(
        user_id=user.id,
        name="General",
        description="Default project for general work",
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(default_project)
    db.commit()

    return {
        **_user_dict(user, token),
        "email_sent": email_sent,
        "message": "Account created. Please check your email to verify your account." if email_sent else "Account created, but the verification email could not be sent. Please contact support or try resending verification.",
    }


@router.post("/api/auth/verify-email")
def verify_email(req: VerifyRequest, db: Session = Depends(get_db)):
    if not req.token:
        raise HTTPException(status_code=400, detail="Token is required")
    vt = db.query(VerificationToken).filter(
        VerificationToken.token == req.token,
        VerificationToken.used == 0,
    ).first()
    if not vt:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")
    if (time.time() - vt.created_at) > _VERIFICATION_TOKEN_EXPIRY:
        raise HTTPException(status_code=400, detail="Verification link has expired. Please request a new one.")
    vt.used = 1
    user = db.query(User).filter(User.id == vt.user_id).first()
    if user:
        user.verified = 1
    db.commit()
    return {"ok": True, "message": "Email verified successfully"}


@router.post("/api/auth/resend-verification")
def resend_verification(req: VerifyRequest, db: Session = Depends(get_db)):
    """Accept email (via token field for simplicity) and resend verification."""
    email = req.token.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Don't reveal whether user exists
        return {"ok": True, "message": "If an account exists, a verification email has been sent"}
    if user.verified:
        return {"ok": True, "message": "Account is already verified"}
    # Invalidate old tokens
    db.query(VerificationToken).filter(
        VerificationToken.user_id == user.id,
        VerificationToken.used == 0,
    ).update({"used": 1})
    raw_token = generate_verification_token()
    vt = VerificationToken(user_id=user.id, token=raw_token)
    db.add(vt)
    db.commit()
    email_sent = send_verification_email(user.email, user.name, raw_token)
    message = "If an account exists, a verification email has been sent" if email_sent else "If an account exists, the verification email could not be sent. Please try again later."
    return {"ok": True, "message": message, "email_sent": email_sent}


@router.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user.id)
    return _user_dict(user, token)


@router.get("/api/auth/me")
def me(user: User = Depends(get_current_user)):
    token = create_token(user.id)
    return _user_dict(user, token)
