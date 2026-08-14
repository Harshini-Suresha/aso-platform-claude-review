"""
Reports API: save, list, get, delete pipeline reports.
"""

from __future__ import annotations

import json
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, Report
from services.auth_service import get_current_user

router = APIRouter()


class ReportCreate(BaseModel):
    step: str
    title: str
    geneSymbol: str = ""
    disease: str = ""
    summary: str = ""
    data: dict = {}


@router.get("/api/reports")
def list_reports(user: User = Depends(get_current_user)):
    reports = sorted(user.reports, key=lambda r: r.created_at, reverse=True)
    return [
        {
            "id": r.id,
            "step": r.step,
            "title": r.title,
            "geneSymbol": r.gene_symbol,
            "disease": r.disease,
            "summary": r.summary,
            "createdAt": r.created_at,
        }
        for r in reports[:100]
    ]


@router.get("/api/reports/{report_id}")
def get_report(report_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.query(Report).filter(Report.id == report_id, Report.user_id == user.id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "id": r.id,
        "step": r.step,
        "title": r.title,
        "geneSymbol": r.gene_symbol,
        "disease": r.disease,
        "summary": r.summary,
        "data": json.loads(r.data) if r.data else {},
        "createdAt": r.created_at,
    }


@router.post("/api/reports")
def save_report(req: ReportCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = Report(
        user_id=user.id,
        step=req.step,
        title=req.title,
        gene_symbol=req.geneSymbol.strip(),
        disease=req.disease.strip(),
        summary=req.summary.strip(),
        data=json.dumps(req.data),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"id": report.id, "createdAt": report.created_at}


@router.delete("/api/reports/{report_id}")
def delete_report(report_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.query(Report).filter(Report.id == report_id, Report.user_id == user.id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(r)
    db.commit()
    return {"ok": True}
