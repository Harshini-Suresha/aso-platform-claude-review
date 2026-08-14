"""Sequence Upload API — validation and analysis endpoints."""

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional

from services.upload_service import validate_sequence, analyze_sequence
from services.notification_service import add_notification

router = APIRouter()


class ValidateRequest(BaseModel):
    sequence: str
    filename: Optional[str] = None


class AnalyzeRequest(BaseModel):
    sequence: str
    modality: str  # aso, sirna, mrna, sgrna


@router.post("/api/upload/validate")
async def validate(payload: ValidateRequest):
    """Validate and parse an uploaded sequence."""
    result = validate_sequence(payload.sequence, payload.filename)
    return result


@router.post("/api/upload/analyze")
async def analyze(payload: AnalyzeRequest):
    """Run full analysis on a validated sequence."""
    cleaned = payload.sequence.upper().replace(" ", "").replace("\n", "").replace("\t", "")
    if not cleaned:
        raise HTTPException(status_code=400, detail="Empty sequence.")

    valid_modalities = {"aso", "sirna", "mrna", "sgrna"}
    if payload.modality.lower() not in valid_modalities:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid modality: {payload.modality}. Must be one of: {', '.join(valid_modalities)}",
        )

    result = analyze_sequence(cleaned, payload.modality.lower())

    add_notification(
        "analysis",
        "Sequence analysis completed",
        f"{payload.modality.upper()} analysis finished for a {len(cleaned)} nt sequence.",
    )

    return result
