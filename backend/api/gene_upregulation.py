"""
Gene Upregulation API — target analysis + ASO candidate generation
for TG02 mechanisms (Gene Activation / Upregulation).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.gene_upregulation_service import (
    get_target_analysis,
    generate_upregulation_candidates,
    get_upregulation_design_options,
)
from services.notification_service import add_notification

router = APIRouter()


class UpregulationCandidateRequest(BaseModel):
    ensembl_gene_id: str
    mechanism_id: str
    aso_length: int = 21
    chemistry: str = "gapmer"
    modifications: list[str] = []
    defect_type: Optional[str] = None
    known_regulatory_element: Optional[str] = None
    gene_symbol: Optional[str] = ""
    organism: Optional[str] = "homo_sapiens"
    # TANGO-specific fields (mechanism A3 only)
    target_poison_exon: Optional[str] = None
    splice_element: Optional[str] = None


@router.get("/api/gene-upregulation/target/{ensembl_gene_id}")
async def target_analysis(
    ensembl_gene_id: str,
    gene_symbol: Optional[str] = None,
    organism: Optional[str] = None,
):
    """Fetch transcript / exon structure for the confirmed gene (TG02)."""
    result = get_target_analysis(
        ensembl_gene_id,
        gene_symbol or "",
        organism or "",
    )
    if not result.get("exons"):
        raise HTTPException(status_code=404, detail="No exon data found for this gene.")
    return result


@router.get("/api/gene-upregulation/options")
async def design_options():
    """Available chemistry, modification, length, and mechanism options."""
    return get_upregulation_design_options()


@router.post("/api/gene-upregulation/generate")
async def generate_aso_candidates(payload: UpregulationCandidateRequest):
    """Generate ranked ASO candidates for the selected TG02 mechanism."""
    target = get_target_analysis(
        payload.ensembl_gene_id,
        payload.gene_symbol or "",
        payload.organism or "",
    )

    if not target.get("mrnaSequence"):
        raise HTTPException(status_code=404, detail="Could not fetch mRNA sequence.")

    try:
        candidates = generate_upregulation_candidates(
            ensembl_gene_id=payload.ensembl_gene_id,
            mechanism_id=payload.mechanism_id,
            aso_length=payload.aso_length,
            chemistry=payload.chemistry,
            modifications=payload.modifications,
            defect_type=payload.defect_type,
            known_regulatory_element=payload.known_regulatory_element,
            gene_symbol=payload.gene_symbol or "",
            organism=payload.organism or "homo_sapiens",
            target_poison_exon=payload.target_poison_exon,
            splice_element=payload.splice_element,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    add_notification(
        "analysis",
        f"Generated {len(candidates)} upregulation candidates",
        f"Candidate design completed for {payload.ensembl_gene_id} ({payload.mechanism_id}).",
    )

    return {
        "geneId": payload.ensembl_gene_id,
        "mechanismId": payload.mechanism_id,
        "chemistry": payload.chemistry,
        "modifications": payload.modifications,
        "asoLength": candidates[0]["length"] if candidates else payload.aso_length,
        "totalExons": len(target.get("exons", [])),
        "cdsLength": target.get("cdsLength"),
        "mechanismNotes": candidates[0].get("mechanismNotes", "") if candidates else "",
        "candidates": candidates,
    }
