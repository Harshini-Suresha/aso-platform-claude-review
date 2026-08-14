"""
RNA Editing API — target analysis + guide RNA candidate generation for TG03.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.gene_silencing_service import get_target_analysis
from services.rna_editing_service import (
    generate_guide_rna_candidates,
    get_rna_editing_design_options,
)
from services.variant_details_service import get_clinvar_variants
from services.notification_service import add_notification

router = APIRouter()


class RnaEditingCandidateRequest(BaseModel):
    ensembl_gene_id: str
    mechanism_id: str
    variant_hgvs: str
    edit_type: str  # a_to_i, c_to_u, trans_splicing
    guide_length: int = 71
    chemistry: str = "2ome_ps"
    modifications: list[str] = ["phosphorothioate"]
    mismatch_pocket: str = "c"  # for A-to-I
    max_bystander_edits: int = 0
    splicing_direction: Optional[str] = None  # for trans-splicing
    abd_length: int = 150  # for trans-splicing
    delivery_context: Optional[str] = None
    gene_symbol: Optional[str] = ""
    organism: Optional[str] = "homo_sapiens"


@router.get("/api/rna-editing/target/{ensembl_gene_id}")
async def target_analysis(
    ensembl_gene_id: str,
    gene_symbol: Optional[str] = None,
    organism: Optional[str] = None,
):
    """Fetch transcript / exon structure for the confirmed gene (TG03)."""
    result = get_target_analysis(
        ensembl_gene_id,
        gene_symbol or "",
        organism or "",
    )
    if not result.get("exons"):
        raise HTTPException(status_code=404, detail="No exon data found for this gene.")
    return result


@router.get("/api/rna-editing/options")
async def design_options():
    """Available chemistry, modification, and length options for RNA editing."""
    return get_rna_editing_design_options()


@router.post("/api/rna-editing/generate")
async def generate_guide_candidates(payload: RnaEditingCandidateRequest):
    """Generate ranked guide RNA candidates for the selected TG03 mechanism."""
    target = get_target_analysis(
        payload.ensembl_gene_id,
        payload.gene_symbol or "",
        payload.organism or "",
    )

    if not target.get("mrnaSequence"):
        raise HTTPException(status_code=404, detail="Could not fetch mRNA sequence.")

    try:
        candidates = generate_guide_rna_candidates(
            ensembl_gene_id=payload.ensembl_gene_id,
            variant_hgvs=payload.variant_hgvs,
            edit_type=payload.edit_type,
            guide_length=payload.guide_length,
            chemistry=payload.chemistry,
            modifications=payload.modifications,
            mismatch_pocket=payload.mismatch_pocket,
            max_bystander_edits=payload.max_bystander_edits,
            splicing_direction=payload.splicing_direction,
            abd_length=payload.abd_length,
            delivery_context=payload.delivery_context,
            mechanism_id=payload.mechanism_id,
            gene_symbol=payload.gene_symbol or "",
            organism=payload.organism or "homo_sapiens",
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    add_notification(
        "analysis",
        f"Generated {len(candidates)} guide RNA candidates",
        f"Guide RNA design completed for {payload.ensembl_gene_id} ({payload.mechanism_id}).",
    )

    return {
        "geneId": payload.ensembl_gene_id,
        "mechanismId": payload.mechanism_id,
        "variantHgvs": payload.variant_hgvs,
        "editType": payload.edit_type,
        "chemistry": payload.chemistry,
        "modifications": payload.modifications,
        "guideLength": payload.guide_length,
        "totalExons": len(target.get("exons", [])),
        "cdsLength": target.get("cdsLength"),
        "mechanismNotes": candidates[0].get("mechanismNotes", "") if candidates else "",
        "splicingDirection": payload.splicing_direction if payload.edit_type == "trans_splicing" else None,
        "abdLength": payload.abd_length if payload.edit_type == "trans_splicing" else None,
        "candidates": candidates,
    }


@router.get("/api/rna-editing/variants/{ensembl_gene_id}")
async def clinvar_variants(ensembl_gene_id: str):
    """Fetch ClinVar pathogenic variants for RNA editing target selection."""
    variants = get_clinvar_variants(ensembl_gene_id)
    return {"geneId": ensembl_gene_id, "variants": variants}
