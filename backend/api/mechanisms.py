"""
Mechanism selection endpoints. Kept separate from main.py's gene retrieval
pipeline since this is a distinct concern (Rulebook Engine, not the
Biological Information Retrieval Engine).

Supports multiple therapeutic goals:
- TG01: Gene Silencing (A1, A2, A12, A15, A21)
- TG02: Gene Activation / Upregulation (A3, A4, A5, A6, A23, A28)
- TG03: RNA Editing / Correction (A13, A16, A17, A18, A19, A20)
- TG04: RNA Processing Modulation (A7, A8, A9, A10, A11)
- TG05: RNA Neutralization (A12, A14, A25)
- TG06: Translational Regulation (A2, A5, A6, A27)
- TG07: Isoform Engineering (A7, A8, A9, A10)
- TG09: Protein Function Modulation (A23)
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from services.mechanism_service import (
    rank_gene_silencing_mechanisms,
    rank_gene_upregulation_mechanisms,
    rank_rna_processing_mechanisms,
    rank_rna_editing_mechanisms,
    rank_rna_neutralization_mechanisms,
    rank_translational_regulation_mechanisms,
    rank_rna_engineering_mechanisms,
    rank_isoform_engineering_mechanisms,
    generate_rna_engineering_candidates,
    DEFECT_TYPES,
    SILENCING_SCOPES,
    GENE_UPREGULATION_DEFECT_TYPES,
    DELIVERY_CONTEXTS,
    SPLICE_DEFECT_TYPES,
    EDIT_TYPES,
    ENZYME_RECRUITMENT,
    MISMATCH_POCKET,
    SPLICING_DIRECTIONS,
    INTRON_SITES,
    NEUTRALIZATION_DEFECT_TYPES,
    NEUTRALIZATION_MODES,
    STERIC_CHEMISTRIES,
    TRANSLATIONAL_GOALS,
    TRANSLATIONAL_TARGET_ELEMENTS,
    TRANSLATIONAL_CHEMISTRIES,
    RNA_ENGINEERING_STRUCTURAL_CLASSES,
    RNA_ENGINEERING_TARGET_TYPES,
    RNA_ENGINEERING_SCAFFOLDS,
    RNA_ENGINEERING_CHEM_STABILIZATIONS,
    RNA_ENGINEERING_K_D_GOALS,
    ISO_ENGINEERING_MECHANISM_IDS,
    ISOFORM_GOAL_DEFECT_MAP,
)
from services.gene_feature_service import analyze_gene_features

router = APIRouter()


class GeneSilencingRequest(BaseModel):
    gene_symbol: str
    defect_type: str
    silencing_scope: str
    delivery_context: Optional[str] = None
    known_variant: Optional[str] = None


class GeneUpregulationRequest(BaseModel):
    gene_symbol: str
    defect_type: str
    delivery_context: Optional[str] = None
    known_regulatory_element: Optional[str] = None
    gene_features: Optional[dict] = None


class RnaProcessingRequest(BaseModel):
    gene_symbol: str
    splice_defect_type: str
    target_exon: Optional[str] = None
    delivery_context: Optional[str] = None
    known_variant: Optional[str] = None


class RnaEditingRequest(BaseModel):
    gene_symbol: str
    edit_type: str
    variant_hgvs: Optional[str] = None
    enzyme_recruitment: Optional[str] = None
    delivery_context: Optional[str] = None
    guide_length: Optional[int] = None
    mismatch_pocket: Optional[str] = None
    max_bystander_edits: Optional[int] = None
    splicing_direction: Optional[str] = None
    intron_site: Optional[str] = None
    abd_length: Optional[int] = None
    exon_count: Optional[int] = None
    intron_count: Optional[int] = None
    total_transcripts: Optional[int] = None


class RnaNeutralizationRequest(BaseModel):
    gene_symbol: str
    molecular_defect: str
    neutralization_mode: str
    repeat_unit: Optional[str] = None
    estimated_repeat_count: Optional[str] = None
    steric_chemistry: Optional[str] = None
    target_rbp: Optional[str] = None
    oligo_length: Optional[int] = None
    delivery_context: Optional[str] = None
    target_gene_type: Optional[str] = None


class TranslationalRegulationRequest(BaseModel):
    gene_symbol: str
    translational_goal: Optional[str] = None
    target_element: Optional[str] = None
    steric_chemistry: Optional[str] = None
    target_rbp: Optional[str] = None
    oligo_length: Optional[int] = None
    delivery_context: Optional[str] = None


class RnaEngineeringRequest(BaseModel):
    gene_symbol: str
    structural_class: str
    target_type: str
    scaffold: str
    chem_stabilization: str
    kd_goal: str
    delivery_context: Optional[str] = None


class IsoformEngineeringRequest(BaseModel):
    gene_symbol: str
    isoform_goal: str
    target_exon_locus: Optional[str] = None
    splice_element_target: Optional[str] = None
    steric_chemistry: Optional[str] = None
    delivery_context: Optional[str] = None


@router.get("/api/mechanisms/options")
async def mechanism_options():
    """Input options for all mechanism selection forms."""
    return {
        "geneSilencing": {
            "defectTypes": [{"id": k, "label": v} for k, v in DEFECT_TYPES.items()],
            "silencingScopes": [{"id": k, "label": v} for k, v in SILENCING_SCOPES.items()],
        },
        "geneUpregulation": {
            "defectTypes": [{"id": k, "label": v} for k, v in GENE_UPREGULATION_DEFECT_TYPES.items()],
        },
        "rnaProcessing": {
            "spliceDefectTypes": [{"id": k, "label": v} for k, v in SPLICE_DEFECT_TYPES.items()],
        },
        "rnaEditing": {
            "editTypes": [{"id": k, "label": v} for k, v in EDIT_TYPES.items()],
            "enzymeRecruitment": [{"id": k, "label": v} for k, v in ENZYME_RECRUITMENT.items()],
            "mismatchPocket": [{"id": k, "label": v} for k, v in MISMATCH_POCKET.items()],
            "splicingDirections": [{"id": k, "label": v} for k, v in SPLICING_DIRECTIONS.items()],
            "intronSites": [{"id": k, "label": v} for k, v in INTRON_SITES.items()],
        },
        "rnaNeutralization": {
            "molecularDefects": [{"id": k, "label": v} for k, v in NEUTRALIZATION_DEFECT_TYPES.items()],
            "neutralizationModes": [{"id": k, "label": v} for k, v in NEUTRALIZATION_MODES.items()],
            "stericChemistries": [{"id": k, "label": v} for k, v in STERIC_CHEMISTRIES.items()],
        },
        "translationalRegulation": {
            "translationalGoals": [{"id": k, "label": v} for k, v in TRANSLATIONAL_GOALS.items()],
            "targetElements": [{"id": k, "label": v} for k, v in TRANSLATIONAL_TARGET_ELEMENTS.items()],
            "stericChemistries": [{"id": k, "label": v} for k, v in TRANSLATIONAL_CHEMISTRIES.items()],
        },
        "rnaEngineering": {
            "structuralClasses": [{"id": k, "label": v} for k, v in RNA_ENGINEERING_STRUCTURAL_CLASSES.items()],
            "targetTypes": [{"id": k, "label": v} for k, v in RNA_ENGINEERING_TARGET_TYPES.items()],
            "scaffolds": [{"id": k, "label": v} for k, v in RNA_ENGINEERING_SCAFFOLDS.items()],
            "chemStabilizations": [{"id": k, "label": v} for k, v in RNA_ENGINEERING_CHEM_STABILIZATIONS.items()],
            "kdGoals": [{"id": k, "label": v} for k, v in RNA_ENGINEERING_K_D_GOALS.items()],
        },
        "deliveryContexts": [{"id": k, "label": v} for k, v in DELIVERY_CONTEXTS.items()],
    }


@router.post("/api/mechanisms/gene-silencing")
async def gene_silencing_mechanisms(payload: GeneSilencingRequest):
    if payload.defect_type not in DEFECT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown defect_type: {payload.defect_type}")
    if payload.silencing_scope not in SILENCING_SCOPES:
        raise HTTPException(status_code=400, detail=f"Unknown silencing_scope: {payload.silencing_scope}")

    results = rank_gene_silencing_mechanisms(
        defect_type=payload.defect_type,
        silencing_scope=payload.silencing_scope,
        delivery_context=payload.delivery_context,
        known_variant=payload.known_variant,
    )

    return {
        "geneSymbol": payload.gene_symbol.strip().upper(),
        "therapeuticGoal": "Gene Silencing",
        "inputs": {
            "defectType": payload.defect_type,
            "silencingScope": payload.silencing_scope,
            "deliveryContext": payload.delivery_context,
            "knownVariant": payload.known_variant,
        },
        "results": results,
    }


@router.post("/api/mechanisms/gene-upregulation")
async def gene_upregulation_mechanisms(payload: GeneUpregulationRequest):
    if payload.defect_type not in GENE_UPREGULATION_DEFECT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown defect_type: {payload.defect_type}")

    results = rank_gene_upregulation_mechanisms(
        defect_type=payload.defect_type,
        delivery_context=payload.delivery_context,
        known_regulatory_element=payload.known_regulatory_element,
        gene_features=payload.gene_features,
    )

    return {
        "geneSymbol": payload.gene_symbol.strip().upper(),
        "therapeuticGoal": "Gene Activation / Upregulation",
        "inputs": {
            "defectType": payload.defect_type,
            "deliveryContext": payload.delivery_context,
            "knownRegulatoryElement": payload.known_regulatory_element,
        },
        "results": results,
    }


@router.post("/api/mechanisms/rna-processing")
async def rna_processing_mechanisms(payload: RnaProcessingRequest):
    if payload.splice_defect_type not in SPLICE_DEFECT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown splice_defect_type: {payload.splice_defect_type}",
        )

    results = rank_rna_processing_mechanisms(
        splice_defect_type=payload.splice_defect_type,
        target_exon=payload.target_exon,
        delivery_context=payload.delivery_context,
        known_variant=payload.known_variant,
    )

    return {
        "geneSymbol": payload.gene_symbol.strip().upper(),
        "therapeuticGoal": "RNA Processing Modulation",
        "inputs": {
            "spliceDefectType": payload.splice_defect_type,
            "targetExon": payload.target_exon,
            "deliveryContext": payload.delivery_context,
            "knownVariant": payload.known_variant,
        },
        "results": results,
    }


@router.post("/api/mechanisms/rna-editing")
async def rna_editing_mechanisms(payload: RnaEditingRequest):
    if payload.edit_type not in EDIT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown edit_type: {payload.edit_type}")
    if payload.enzyme_recruitment and payload.enzyme_recruitment not in ENZYME_RECRUITMENT:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown enzyme_recruitment: {payload.enzyme_recruitment}",
        )
    if payload.mismatch_pocket and payload.mismatch_pocket not in MISMATCH_POCKET:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown mismatch_pocket: {payload.mismatch_pocket}",
        )
    if payload.splicing_direction and payload.splicing_direction not in SPLICING_DIRECTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown splicing_direction: {payload.splicing_direction}",
        )

    results = rank_rna_editing_mechanisms(
        edit_type=payload.edit_type,
        variant_hgvs=payload.variant_hgvs,
        enzyme_recruitment=payload.enzyme_recruitment,
        delivery_context=payload.delivery_context,
        guide_length=payload.guide_length,
        mismatch_pocket=payload.mismatch_pocket,
        max_bystander_edits=payload.max_bystander_edits,
        exon_count=payload.exon_count,
        intron_count=payload.intron_count,
        total_transcripts=payload.total_transcripts,
    )

    return {
        "geneSymbol": payload.gene_symbol.strip().upper(),
        "therapeuticGoal": "RNA Editing / Correction",
        "inputs": {
            "editType": payload.edit_type,
            "variantHgvs": payload.variant_hgvs,
            "enzymeRecruitment": payload.enzyme_recruitment,
            "deliveryContext": payload.delivery_context,
            "guideLength": payload.guide_length,
            "mismatchPocket": payload.mismatch_pocket,
            "maxBystanderEdits": payload.max_bystander_edits,
            "splicingDirection": payload.splicing_direction,
            "intronSite": payload.intron_site,
            "abdLength": payload.abd_length,
        },
        "results": results,
    }


@router.post("/api/mechanisms/rna-neutralization")
async def rna_neutralization_mechanisms(payload: RnaNeutralizationRequest):
    if payload.molecular_defect not in NEUTRALIZATION_DEFECT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown molecular_defect: {payload.molecular_defect}",
        )
    if payload.neutralization_mode not in NEUTRALIZATION_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown neutralization_mode: {payload.neutralization_mode}",
        )
    if payload.steric_chemistry and payload.steric_chemistry not in STERIC_CHEMISTRIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown steric_chemistry: {payload.steric_chemistry}",
        )

    results = rank_rna_neutralization_mechanisms(
        molecular_defect=payload.molecular_defect,
        neutralization_mode=payload.neutralization_mode,
        repeat_unit=payload.repeat_unit,
        estimated_repeat_count=payload.estimated_repeat_count,
        steric_chemistry=payload.steric_chemistry,
        target_rbp=payload.target_rbp,
        oligo_length=payload.oligo_length,
        delivery_context=payload.delivery_context,
        target_gene_type=payload.target_gene_type,
    )

    return {
        "geneSymbol": payload.gene_symbol.strip().upper(),
        "therapeuticGoal": "RNA Neutralization",
        "inputs": {
            "molecularDefect": payload.molecular_defect,
            "neutralizationMode": payload.neutralization_mode,
            "repeatUnit": payload.repeat_unit,
            "estimatedRepeatCount": payload.estimated_repeat_count,
            "stericChemistry": payload.steric_chemistry,
            "targetRbp": payload.target_rbp,
            "oligoLength": payload.oligo_length,
            "deliveryContext": payload.delivery_context,
            "targetGeneType": payload.target_gene_type,
        },
         "results": results,
     }


@router.post("/api/mechanisms/translational-regulation")
async def translational_regulation_mechanisms(payload: TranslationalRegulationRequest):
     if payload.translational_goal and payload.translational_goal not in TRANSLATIONAL_GOALS:
         raise HTTPException(
             status_code=400,
             detail=f"Unknown translational_goal: {payload.translational_goal}",
         )
     if payload.target_element and payload.target_element not in TRANSLATIONAL_TARGET_ELEMENTS:
         raise HTTPException(
             status_code=400,
             detail=f"Unknown target_element: {payload.target_element}",
         )
     if payload.steric_chemistry and payload.steric_chemistry not in TRANSLATIONAL_CHEMISTRIES:
         raise HTTPException(
             status_code=400,
             detail=f"Unknown steric_chemistry: {payload.steric_chemistry}",
         )

     results = rank_translational_regulation_mechanisms(
         translational_goal=payload.translational_goal,
         target_element=payload.target_element,
         steric_chemistry=payload.steric_chemistry,
         target_rbp=payload.target_rbp,
         oligo_length=payload.oligo_length,
         delivery_context=payload.delivery_context,
     )

     return {
         "geneSymbol": payload.gene_symbol.strip().upper(),
         "therapeuticGoal": "Translational Regulation",
         "inputs": {
             "translationalGoal": payload.translational_goal,
             "targetElement": payload.target_element,
             "stericChemistry": payload.steric_chemistry,
             "targetRbp": payload.target_rbp,
             "oligoLength": payload.oligo_length,
             "deliveryContext": payload.delivery_context,
         },
         "results": results,
      }


@router.post("/api/mechanisms/rna-engineering")
async def rna_engineering_mechanisms(payload: RnaEngineeringRequest):
    if payload.structural_class not in RNA_ENGINEERING_STRUCTURAL_CLASSES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown structural_class: {payload.structural_class}",
        )
    if payload.target_type not in RNA_ENGINEERING_TARGET_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown target_type: {payload.target_type}",
        )
    if payload.scaffold not in RNA_ENGINEERING_SCAFFOLDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scaffold: {payload.scaffold}",
        )
    if payload.chem_stabilization not in RNA_ENGINEERING_CHEM_STABILIZATIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown chem_stabilization: {payload.chem_stabilization}",
        )
    if payload.kd_goal not in RNA_ENGINEERING_K_D_GOALS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown kd_goal: {payload.kd_goal}",
        )

    mechanisms = rank_rna_engineering_mechanisms(
        structural_class=payload.structural_class,
        target_type=payload.target_type,
        scaffold=payload.scaffold,
        chem_stabilization=payload.chem_stabilization,
        kd_goal=payload.kd_goal,
        gene_symbol=payload.gene_symbol,
        delivery_context=payload.delivery_context,
    )

    candidates = generate_rna_engineering_candidates(
        structural_class=payload.structural_class,
        target_type=payload.target_type,
        scaffold=payload.scaffold,
        chem_stabilization=payload.chem_stabilization,
        kd_goal=payload.kd_goal,
        gene_symbol=payload.gene_symbol,
    )

    return {
        "geneSymbol": payload.gene_symbol.strip().upper(),
        "therapeuticGoal": "Protein Function Modulation",
        "inputs": {
            "structuralClass": payload.structural_class,
            "targetType": payload.target_type,
            "scaffold": payload.scaffold,
            "chemStabilization": payload.chem_stabilization,
            "kdGoal": payload.kd_goal,
            "deliveryContext": payload.delivery_context,
        },
        "mechanisms": mechanisms,
        "candidates": candidates,
    }


@router.post("/api/mechanisms/isoform-engineering")
async def isoform_engineering_mechanisms(payload: IsoformEngineeringRequest):
    if payload.isoform_goal not in ISOFORM_GOAL_DEFECT_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown isoform_goal: {payload.isoform_goal}",
        )

    results = rank_isoform_engineering_mechanisms(
        isoform_goal=payload.isoform_goal,
        target_exon_locus=payload.target_exon_locus,
        splice_element_target=payload.splice_element_target,
        steric_chemistry=payload.steric_chemistry,
        delivery_context=payload.delivery_context,
    )

    return {
        "geneSymbol": payload.gene_symbol.strip().upper(),
        "therapeuticGoal": "Isoform Engineering",
        "inputs": {
            "isoformGoal": payload.isoform_goal,
            "targetExonLocus": payload.target_exon_locus,
            "spliceElementTarget": payload.splice_element_target,
            "stericChemistry": payload.steric_chemistry,
            "deliveryContext": payload.delivery_context,
        },
        "results": results,
    }


@router.get("/api/mechanisms/gene-features")
async def gene_features(
    gene_symbol: str = Query(..., description="Gene symbol to analyze"),
    organism: str = Query("homo_sapiens", description="Species slug"),
    ensembl_id: Optional[str] = Query(None, description="Ensembl gene ID (optional)"),
    tissue_tpm: Optional[float] = Query(None, description="Baseline tissue TPM for overexpression warning"),
    exon_count: Optional[int] = Query(None, description="Known exon count from the gene pipeline (optional)"),
    total_transcripts: Optional[int] = Query(None, description="Known transcript count from the gene pipeline (optional)"),
    gene_type: Optional[str] = Query(None, description="Gene biotype, e.g. protein_coding (optional)"),
):
    """Analyze gene structural features to determine TG02 mechanism availability."""
    result = analyze_gene_features(
        gene_symbol=gene_symbol.strip(),
        organism=organism.strip(),
        ensembl_id=ensembl_id.strip() if ensembl_id else None,
        tissue_tpm=tissue_tpm,
        exon_count=exon_count,
        total_transcripts=total_transcripts,
        gene_type=gene_type,
    )
    return result
