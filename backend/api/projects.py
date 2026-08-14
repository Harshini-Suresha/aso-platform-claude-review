"""
Projects API: create, list, get, update, delete therapeutic projects.
"""

from __future__ import annotations

import json
import time

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, Project
from services.auth_service import get_current_user

router = APIRouter()


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    organism: str = "homo_sapiens"
    disease: str = ""
    geneSymbol: str = ""
    ensemblId: str = ""
    therapeuticGoal: str = ""
    cellLine: str = ""
    notes: str = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    organism: Optional[str] = None
    disease: Optional[str] = None
    geneSymbol: Optional[str] = None
    ensemblId: Optional[str] = None
    therapeuticGoal: Optional[str] = None
    cellLine: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


def _project_summary(p: Project) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "organism": p.organism,
        "disease": p.disease,
        "geneSymbol": p.gene_symbol,
        "therapeuticGoal": p.therapeutic_goal,
        "status": p.status,
        "createdAt": p.created_at,
        "updatedAt": p.updated_at,
    }


def _project_detail(p: Project) -> dict:
    return {
        **_project_summary(p),
        "ensemblId": p.ensembl_id,
        "targetTissue": p.target_tissue,
        "cellLine": p.cell_line,
        "notes": p.notes,
    }


@router.get("/api/projects")
def list_projects(
    search: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
):
    projects = sorted(user.projects, key=lambda p: p.updated_at, reverse=True)
    if search:
        q = search.lower()
        projects = [
            p for p in projects
            if q in p.name.lower()
            or q in p.disease.lower()
            or q in p.gene_symbol.lower()
            or q in p.description.lower()
        ]
    return [_project_summary(p) for p in projects[:100]]


@router.get("/api/projects/{project_id}")
def get_project(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_detail(p)


@router.post("/api/projects")
def create_project(req: ProjectCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = time.time()
    project = Project(
        user_id=user.id,
        name=req.name.strip(),
        description=req.description.strip(),
        organism=req.organism.strip() or "homo_sapiens",
        disease=req.disease.strip(),
        gene_symbol=req.geneSymbol.strip(),
        ensembl_id=req.ensemblId.strip(),
        therapeutic_goal=req.therapeuticGoal.strip(),
        cell_line=req.cellLine.strip(),
        notes=req.notes.strip(),
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_detail(project)


@router.put("/api/projects/{project_id}")
def update_project(
    project_id: int,
    req: ProjectUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    if req.name is not None:
        p.name = req.name.strip()
    if req.description is not None:
        p.description = req.description.strip()
    if req.organism is not None:
        p.organism = req.organism.strip()
    if req.disease is not None:
        p.disease = req.disease.strip()
    if req.geneSymbol is not None:
        p.gene_symbol = req.geneSymbol.strip()
    if req.ensemblId is not None:
        p.ensembl_id = req.ensemblId.strip()
    if req.therapeuticGoal is not None:
        p.therapeutic_goal = req.therapeuticGoal.strip()
    if req.cellLine is not None:
        p.cell_line = req.cellLine.strip()
    if req.notes is not None:
        p.notes = req.notes.strip()
    if req.status is not None:
        p.status = req.status.strip()

    p.updated_at = time.time()
    db.commit()
    db.refresh(p)
    return _project_detail(p)


@router.delete("/api/projects/{project_id}")
def delete_project(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(p)
    db.commit()
    return {"ok": True}
