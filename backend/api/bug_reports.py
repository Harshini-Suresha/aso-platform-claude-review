"""
Bug Reports API: in-app ticketing system with optional email notification.
"""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, BugReport
from services.auth_service import get_current_user
from services.email_service import send_bug_report_email

router = APIRouter()


class BugReportCreate(BaseModel):
    area: str
    summary: str
    steps: str = ""
    expected: str = ""
    actual: str = ""
    page_url: str = ""
    send_email: bool = False


class BugReportUpdate(BaseModel):
    status: str = ""


@router.get("/api/bug-reports")
def list_bug_reports(user: User = Depends(get_current_user)):
    reports = sorted(user.bug_reports, key=lambda r: r.created_at, reverse=True)
    return [
        {
            "id": r.id,
            "area": r.area,
            "summary": r.summary,
            "steps": r.steps,
            "expected": r.expected,
            "actual": r.actual,
            "page_url": r.page_url,
            "status": r.status,
            "created_at": r.created_at,
        }
        for r in reports[:100]
    ]


@router.get("/api/bug-reports/{report_id}")
def get_bug_report(report_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.query(BugReport).filter(BugReport.id == report_id, BugReport.user_id == user.id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Bug report not found")
    return {
        "id": r.id,
        "area": r.area,
        "summary": r.summary,
        "steps": r.steps,
        "expected": r.expected,
        "actual": r.actual,
        "page_url": r.page_url,
        "status": r.status,
        "created_at": r.created_at,
    }


@router.post("/api/bug-reports")
def create_bug_report(req: BugReportCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = BugReport(
        user_id=user.id,
        area=req.area.strip(),
        summary=req.summary.strip(),
        steps=req.steps.strip(),
        expected=req.expected.strip(),
        actual=req.actual.strip(),
        page_url=req.page_url.strip(),
        status="open",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    email_result = None
    if req.send_email:
        sent, message = send_bug_report_email(
            email=user.email,
            name=user.name,
            area=report.area,
            summary=report.summary,
            steps=report.steps,
            expected=report.expected,
            actual=report.actual,
            page_url=report.page_url,
        )
        email_result = {"sent": sent, "message": message}

    return {
        "id": report.id,
        "status": report.status,
        "created_at": report.created_at,
        "email_result": email_result,
    }


@router.delete("/api/bug-reports/{report_id}")
def delete_bug_report(report_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.query(BugReport).filter(BugReport.id == report_id, BugReport.user_id == user.id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Bug report not found")
    db.delete(r)
    db.commit()
    return {"ok": True}
