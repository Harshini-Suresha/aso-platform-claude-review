"""
Profile CRUD: user info, research interests, saved designs, favorites, activity.
"""

from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, ResearchInterest, SavedDesign, FavoriteGene, RecentActivity
from services.auth_service import get_current_user

router = APIRouter()


# ── helpers ──────────────────────────────────────────────────────────────────

def _log_activity(db: Session, user_id: int, action: str, detail: str = "") -> None:
    db.add(RecentActivity(user_id=user_id, action=action, detail=detail, timestamp=time.time()))
    db.commit()


# ── profile (user info) ─────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    institution: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None


@router.get("/api/profile")
def get_profile(user: User = Depends(get_current_user)):
    interests = [{"id": i.id, "topic": i.topic, "description": i.description} for i in user.interests]
    designs = [{"id": d.id, "name": d.name, "geneSymbol": d.gene_symbol, "ensemblId": d.ensembl_id,
                "disease": d.disease, "sequence": d.sequence, "notes": d.notes, "createdAt": d.created_at}
               for d in user.saved_designs]
    favs = [{"id": f.id, "geneSymbol": f.gene_symbol, "ensemblId": f.ensembl_id,
             "note": f.note, "createdAt": f.created_at} for f in user.favorites]
    activity = [{"id": a.id, "action": a.action, "detail": a.detail, "timestamp": a.timestamp}
                for a in sorted(user.activity, key=lambda x: x.timestamp, reverse=True)[:50]]

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
        "interests": interests,
        "savedDesigns": designs,
        "favorites": favs,
        "activity": activity,
        "storage": {
            "designs": len(user.saved_designs),
            "favorites": len(user.favorites),
            "interests": len(user.interests),
        },
    }


@router.put("/api/profile")
def update_profile(req: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.name is not None:
        user.name = req.name.strip()
    if req.email is not None:
        new_email = req.email.lower().strip()
        existing = db.query(User).filter(User.email == new_email, User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")
        user.email = new_email
    if req.role is not None:
        user.role = req.role.strip()
    if req.institution is not None:
        user.institution = req.institution.strip()
    if req.department is not None:
        user.department = req.department.strip()
    if req.bio is not None:
        user.bio = req.bio.strip()
    db.commit()
    _log_activity(db, user.id, "Updated profile", "Personal information updated")
    initials = ""
    if user.name:
        parts = user.name.strip().split()
        initials = "".join(p[0].upper() for p in parts[:2])
    return {"ok": True, "initials": initials}


# ── research interests ──────────────────────────────────────────────────────

class InterestCreate(BaseModel):
    topic: str
    description: str = ""


@router.get("/api/profile/interests")
def list_interests(user: User = Depends(get_current_user)):
    return [{"id": i.id, "topic": i.topic, "description": i.description} for i in user.interests]


@router.post("/api/profile/interests")
def add_interest(req: InterestCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required")
    interest = ResearchInterest(user_id=user.id, topic=req.topic.strip(), description=req.description.strip())
    db.add(interest)
    db.commit()
    db.refresh(interest)
    _log_activity(db, user.id, "Added research interest", req.topic.strip())
    return {"id": interest.id, "topic": interest.topic, "description": interest.description}


@router.delete("/api/profile/interests/{interest_id}")
def delete_interest(interest_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    interest = db.query(ResearchInterest).filter(ResearchInterest.id == interest_id, ResearchInterest.user_id == user.id).first()
    if not interest:
        raise HTTPException(status_code=404, detail="Not found")
    topic = interest.topic
    db.delete(interest)
    db.commit()
    _log_activity(db, user.id, "Removed research interest", topic)
    return {"ok": True}


# ── saved designs ───────────────────────────────────────────────────────────

class DesignCreate(BaseModel):
    name: str
    geneSymbol: str = ""
    ensemblId: str = ""
    disease: str = ""
    sequence: str = ""
    notes: str = ""


@router.get("/api/profile/saved-designs")
def list_designs(user: User = Depends(get_current_user)):
    return [{"id": d.id, "name": d.name, "geneSymbol": d.gene_symbol, "ensemblId": d.ensembl_id,
             "disease": d.disease, "sequence": d.sequence, "notes": d.notes, "createdAt": d.created_at}
            for d in sorted(user.saved_designs, key=lambda x: x.created_at, reverse=True)]


@router.post("/api/profile/saved-designs")
def add_design(req: DesignCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    design = SavedDesign(
        user_id=user.id, name=req.name.strip(), gene_symbol=req.geneSymbol.strip(),
        ensembl_id=req.ensemblId.strip(), disease=req.disease.strip(),
        sequence=req.sequence.strip(), notes=req.notes.strip(),
    )
    db.add(design)
    db.commit()
    db.refresh(design)
    _log_activity(db, user.id, "Saved ASO design", req.name.strip())
    return {"id": design.id, "name": design.name, "geneSymbol": design.gene_symbol,
            "ensemblId": design.ensembl_id, "disease": design.disease,
            "createdAt": design.created_at}


@router.delete("/api/profile/saved-designs/{design_id}")
def delete_design(design_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    design = db.query(SavedDesign).filter(SavedDesign.id == design_id, SavedDesign.user_id == user.id).first()
    if not design:
        raise HTTPException(status_code=404, detail="Not found")
    name = design.name
    db.delete(design)
    db.commit()
    _log_activity(db, user.id, "Deleted saved design", name)
    return {"ok": True}


# ── favorite genes ──────────────────────────────────────────────────────────

class FavoriteCreate(BaseModel):
    geneSymbol: str
    ensemblId: str = ""
    note: str = ""


@router.get("/api/profile/favorites")
def list_favorites(user: User = Depends(get_current_user)):
    return [{"id": f.id, "geneSymbol": f.gene_symbol, "ensemblId": f.ensembl_id,
             "note": f.note, "createdAt": f.created_at}
            for f in sorted(user.favorites, key=lambda x: x.created_at, reverse=True)]


@router.post("/api/profile/favorites")
def add_favorite(req: FavoriteCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.geneSymbol.strip():
        raise HTTPException(status_code=400, detail="Gene symbol is required")
    existing = db.query(FavoriteGene).filter(
        FavoriteGene.user_id == user.id,
        FavoriteGene.gene_symbol == req.geneSymbol.strip().upper()
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Gene already in favorites")
    fav = FavoriteGene(
        user_id=user.id, gene_symbol=req.geneSymbol.strip().upper(),
        ensembl_id=req.ensemblId.strip(), note=req.note.strip(),
    )
    db.add(fav)
    db.commit()
    db.refresh(fav)
    _log_activity(db, user.id, "Added favorite gene", req.geneSymbol.strip().upper())
    return {"id": fav.id, "geneSymbol": fav.gene_symbol, "ensemblId": fav.ensembl_id,
            "note": fav.note, "createdAt": fav.created_at}


@router.delete("/api/profile/favorites/{fav_id}")
def delete_favorite(fav_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fav = db.query(FavoriteGene).filter(FavoriteGene.id == fav_id, FavoriteGene.user_id == user.id).first()
    if not fav:
        raise HTTPException(status_code=404, detail="Not found")
    gene = fav.gene_symbol
    db.delete(fav)
    db.commit()
    _log_activity(db, user.id, "Removed favorite gene", gene)
    return {"ok": True}


# ── recent activity ─────────────────────────────────────────────────────────

@router.get("/api/profile/activity")
def list_activity(user: User = Depends(get_current_user)):
    return [{"id": a.id, "action": a.action, "detail": a.detail, "timestamp": a.timestamp}
            for a in sorted(user.activity, key=lambda x: x.timestamp, reverse=True)[:100]]
