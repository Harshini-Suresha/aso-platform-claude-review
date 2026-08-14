"""
Protein Replacement (TG08) API endpoints.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.protein_replacement_service import (
    generate_protein_replacement_candidates,
    get_protein_replacement_options,
)


class ProteinReplacementRequest(BaseModel):
    target_symbol: str
    rna_modality: str
    codon_strategy: str
    utr_pair: str
    ires_selection: Optional[str] = None
    nucleotide_modification: str
    organism: Optional[str] = "homo_sapiens"


router = APIRouter()


@router.get("/api/protein-replacement/options")
async def protein_replacement_options():
    """Return design option catalogs for the protein replacement form."""
    return get_protein_replacement_options()


@router.post("/api/protein-replacement/generate")
async def generate_protein_replacement(payload: ProteinReplacementRequest):
    """Generate ranked protein replacement construct candidates."""
    try:
        result = generate_protein_replacement_candidates(
            target_symbol=payload.target_symbol,
            rna_modality=payload.rna_modality,
            codon_strategy=payload.codon_strategy,
            utr_pair=payload.utr_pair,
            ires_selection=payload.ires_selection,
            nucleotide_modification=payload.nucleotide_modification,
            organism=payload.organism or "homo_sapiens",
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
