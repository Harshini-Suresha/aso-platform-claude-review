"""Per-goal entry points, kept as thin filters over the unified arbitration.

WHAT CHANGED AND WHY
--------------------
This module used to hold nine separate scoring paths, one per therapeutic
goal, plus four central compatibility tables. All of that is gone. Scoring
now happens once, in `mechanism_arbitration`, over every designable
mechanism; the therapeutic goal is an OUTPUT of that pass, not an input to
it.

The functions below survive because the frontend still routes users by goal.
They are now **filters applied after scoring**, never separate scorers. Two
callers get the same answer for the same transcript regardless of which door
they came through, which is the property that was impossible when nine
mechanism sets overlapping in nine ways each had their own ranking code.

Deleted here, and why:

  DEFECT_COMPATIBILITY, SCOPE_COMPATIBILITY,
  UPREGULATION_DEFECT_COMPATIBILITY, SPLICE_DEFECT_COMPATIBILITY
      These restated each mechanism's own `suitableVariantTypes` and
      `molecularDefect` in a second place, where they could silently diverge
      from the rulebook they were derived from. They now live in each
      mechanism's rule.json under `arbitration`.

  rank_translational_regulation_mechanisms  (TG06)
  rank_isoform_engineering_mechanisms       (TG07)
      Both scored mechanism sets that belong to other goals — TG07's set is a
      strict subset of TG04's. Two code paths over an identical mechanism set
      can only ever diverge. Both goals survive as display tags; all their
      mechanisms remain available.

  generate_rna_engineering_candidates and its helpers  (TG09)
      Generated sequences, melting temperatures, folding free energies and
      binding affinities from `hash()` of the input strings. Those were not
      predictions, they were deterministic noise formatted to look like
      measurements. TG09 is now a rulebook lookup with no score and no rank.

See docs/planning/therapeutic_goal_scope_plan.md.
"""

from __future__ import annotations

from .mechanism_arbitration import (  # noqa: F401  (re-exported)
    DELIVERY_CONTEXTS,
    DELIVERY_PRECEDENT,
    DELIVERY_TIER_WEIGHT,
    EVIDENCE_WEIGHT,
    MOLECULAR_DEFECTS,
    RETIRED_AS_SCORING_PARTITION,
    ArbitrationContext,
    arbitrate,
    canonical_defect,
    load_rule,
    parse_hgvs_substitution,
)
from .feature_service import (  # noqa: F401  (re-exported)
    KNOWN_REPEAT_UNITS,
    PATHOGENIC_REPEAT_THRESHOLD,
)

# ---------------------------------------------------------------------------
# Input vocabularies
#
# These are the form options each goal's page renders. They are now VIEWS onto
# the single unified defect vocabulary rather than four independent lists, so
# a term cannot mean one thing on the silencing page and another on the
# neutralization page.
# ---------------------------------------------------------------------------


def _defects(*keys: str) -> dict[str, str]:
    return {k: MOLECULAR_DEFECTS[k] for k in keys}


DEFECT_TYPES = _defects(
    "gain_of_function",
    "overexpression",
    "mirna_dysregulation",
    "viral_toxic_rna",
    "therapeutic_reduction",
)

SILENCING_SCOPES = {
    "total_knockdown": "Total transcript knockdown",
    "allele_specific": "Allele-specific silencing (spare wild-type)",
}

GENE_UPREGULATION_DEFECT_TYPES = _defects(
    "haploinsufficiency",
    "poison_exon_inclusion",
    "nat_mediated_repression",
    "uorf_mediated_repression",
    "mirna_mediated_repression",
    "rbp_mediated_repression",
    "epigenetic_promoter_silencing",
)

SPLICE_DEFECT_TYPES = _defects(
    "exon_skipping_mutation",
    "exon_inclusion_defect",
    "cryptic_splice_site",
    "pseudoexon_activation",
    "apa_dysregulation",
)

NEUTRALIZATION_DEFECT_TYPES = {
    **_defects("toxic_rna_gain_of_function", "rbp_sequestration"),
    # Kept as selectable input for backward compatibility. Both alias onto
    # unified terms; see DEFECT_ALIASES for why each is a genuine synonym
    # rather than a convenience merge.
    "pathogenic_mirna": "Pathogenic microRNA / ncRNA overexpression",
    "loss_of_function": "Pure loss-of-function (haploinsufficiency / null)",
}

EDIT_TYPES = {
    "a_to_i": "A-to-I Editing (ADAR Recruitment)",
    "c_to_u": "C-to-U Editing (APOBEC / RESCUE)",
    "trans_splicing": "Trans-Splicing / Pre-mRNA Repair (SMaRT)",
}

ENZYME_RECRUITMENT = {
    "adar1": "Endogenous ADAR1 (p110/p150)",
    "adar2": "Endogenous ADAR2",
    "exogenous_deaminase": "Exogenous Deaminase (engineered)",
}

MISMATCH_POCKET = {
    "c": "C (A-C Mismatch — High Efficiency)",
    "g": "G",
    "u": "U",
}

SPLICING_DIRECTIONS = {
    "three_prime": "3' Exon Replacement",
    "five_prime": "5' Exon Replacement",
}

INTRON_SITES = {
    "acceptor_junction": "Acceptor Junction",
    "donor_junction": "Donor Junction",
}

NEUTRALIZATION_MODES = {
    "steric_repeat_masking": "Steric Repeat Masking (RNase H-Independent)",
    "microrna_antagomir": "MicroRNA / ncRNA Antagomir",
    "aptamer_decoy": "Aptamer Decoy Sequestration",
}

NEUTRALIZATION_MODE_MECHANISMS = {
    "steric_repeat_masking": ["A14"],
    "microrna_antagomir": ["A12"],
    "aptamer_decoy": ["A25"],
}

STERIC_CHEMISTRIES = {
    "pmo": "PMO (Morpholino)",
    "moe_full_ps": "2'-O-MOE Full Phosphorothioate",
    "lna_dna_mixmer": "LNA / DNA Mixmer",
}

TRANSLATIONAL_GOALS = {
    "enhance": "Enhance Translation (Upregulate Protein)",
    "suppress": "Suppress Translation (Downregulate Protein)",
}

TRANSLATIONAL_TARGET_ELEMENTS = {
    "5p_utr": "5' UTR / Kozak Sequence",
    "3p_utr_mirna": "3' UTR miRNA Seed Site",
    "uorf": "5' UTR uORF / Upstream AUG",
    "structured_element": "IRES / G-quadruplex / Riboswitch",
}

TRANSLATIONAL_CHEMISTRIES = {
    "pmo": "PMO (Phosphorodiamidate Morpholino) — Recommended for 5' UTR blocking",
    "moe_full_ps": "2'-O-MOE Full Phosphorothioate",
    "lna_dna_mixmer": "LNA / DNA Mixmer (Steric Blockade)",
}

# TG06 is no longer a scoring partition, so this maps a (goal, element) pair
# onto the unified defect vocabulary instead of onto a private mechanism list.
TRANSLATIONAL_ELEMENT_DEFECT: dict[tuple[str, str], str] = {
    ("suppress", "5p_utr"): "gain_of_function",
    ("enhance", "3p_utr_mirna"): "mirna_mediated_repression",
    ("enhance", "uorf"): "uorf_mediated_repression",
    ("suppress", "structured_element"): "structured_element_dysregulation",
    ("enhance", "structured_element"): "structured_element_dysregulation",
}

ISO_ENGINEERING_MECHANISM_IDS = ["A7", "A8", "A9", "A10"]

# NOTE: `intron_retention` maps to a defect served only by A11, which is not a
# TG07 mechanism — so this row has always produced an empty ranking. Preserved
# verbatim rather than quietly repaired; correcting it is a product decision
# about what "intron retention" should mean here, not a code fix.
ISOFORM_GOAL_DEFECT_MAP = {
    "exon_skipping": "exon_skipping_mutation",
    "exon_inclusion": "exon_inclusion_defect",
    "intron_retention": "apa_dysregulation",
    "alternative_splice_site": "cryptic_splice_site",
    "mutually_exclusive_exon": "exon_inclusion_defect",
}

# TG09 form vocabularies. Retained so the existing page still renders; the
# endpoint now returns a rulebook lookup rather than generated candidates.
RNA_ENGINEERING_STRUCTURAL_CLASSES = {
    "rna_aptamer": "RNA Aptamer (Protein / Ligand Binding)",
    "catalytic_ribozyme": "Catalytic Ribozyme (mRNA Cleavage)",
    "riboswitch": "Riboswitch / Inducible RNA Sensor",
    "multivalent_scaffold": "Multivalent / Chimeric RNA Scaffold",
}

RNA_ENGINEERING_TARGET_TYPES = {
    "protein_active_site": "Protein Active Site / Surface Domain",
    "cell_surface_receptor": "Cell Surface Receptor (Internalizing)",
    "small_molecule": "Small Molecule / Metabolite",
    "target_rna": "Target RNA Transcript (Cleavage Site)",
}

RNA_ENGINEERING_SCAFFOLDS = {
    "selex_refinement": "SELEX Motif Structural Refinement",
    "hammerhead": "Hammerhead Architecture (Type I / Type III)",
    "three_way_junction": "3-Way Junction / Stable Stem-Loop Scaffold",
}

RNA_ENGINEERING_CHEM_STABILIZATIONS = {
    "two_f_pyrimidine": "2'-Fluoro-Pyrimidine (2'-F)",
    "two_ome_ps": "2'-O-Methyl (2'-OMe) / Phosphorothioate Stems",
    "inverted_abasic": "Inverted Abasic End-Cap (3'-3' Attachment)",
}

RNA_ENGINEERING_K_D_GOALS = {
    "nanomolar": "Nanomolar (1–10 nM)",
    "sub_nanomolar": "Sub-nanomolar (< 1 nM)",
}


# ---------------------------------------------------------------------------
# Shared plumbing
# ---------------------------------------------------------------------------

def _filtered(ctx: ArbitrationContext, goal: str,
              restrict_to: list[str] | None = None) -> list[dict]:
    """Run the unified arbitration, then keep the goal's mechanisms.

    The filter is applied to a finished ranking. It changes what the caller
    SEES, never what was scored or how — which is the whole point of making
    the goal an output.
    """
    ctx.goal_filter = [goal]
    results = arbitrate(ctx)["results"]
    if restrict_to is not None:
        allowed = set(restrict_to)
        results = [r for r in results if r["id"] in allowed]
    return [_legacy_shape(r) for r in results]


def _legacy_shape(result: dict) -> dict:
    """Add the two fields the pre-arbitration response carried.

    `keywordMatch` was a soft bonus for the user's free-text variant
    description overlapping a mechanism's `suitableVariantTypes`. It is not
    evidence about the transcript, so it no longer influences the ranking;
    the field is kept at False so existing consumers do not break.
    """
    return {**result, "keywordMatch": False}


def _drop_non_designable(results: list[dict]) -> list[dict]:
    """Hide mechanisms this pipeline cannot produce a design for.

    A21 (siRNA duplex), A24 (mRNA) and A26 (circRNA) stay in the rulebooks and
    stay visible in the unified `/arbitrate` response with an honest reason.
    The per-goal pages offer a design flow, so surfacing an option that
    cannot reach a design is a dead end there.
    """
    return [r for r in results if r["status"] not in ("NOT_DESIGNABLE", "OUT_OF_SCOPE")]


# ---------------------------------------------------------------------------
# TG01 — Gene Silencing
# ---------------------------------------------------------------------------

def rank_gene_silencing_mechanisms(
    defect_type: str,
    silencing_scope: str,
    delivery_context: str | None,
    known_variant: str | None,
    transcript_sequence: str | None = None,
    cds_start: int | None = None,
) -> list[dict]:
    """TG01 view of the unified ranking.

    `transcript_sequence` / `cds_start` are optional but they are what
    separates A1 from A2: A1 needs an accessible cleavable site anywhere in
    the transcript (F10a), A2 needs one at the 5' UTR or start codon (F10b).
    Without a sequence neither query can run and the two tie on evidence
    alone, exactly as they did before.
    """
    ctx = ArbitrationContext(
        molecular_defect=defect_type,
        allele_selective=(silencing_scope == "allele_specific"),
        delivery_context=delivery_context,
        known_variant=known_variant,
        transcript_sequence=transcript_sequence,
        cds_start=cds_start,
    )
    return _drop_non_designable(_filtered(ctx, "TG01"))


# ---------------------------------------------------------------------------
# TG02 — Gene Activation / Upregulation
# ---------------------------------------------------------------------------

def rank_gene_upregulation_mechanisms(
    defect_type: str,
    delivery_context: str | None,
    known_regulatory_element: str | None,
    gene_features: dict | None = None,
) -> list[dict]:
    ctx = ArbitrationContext(
        molecular_defect=defect_type,
        delivery_context=delivery_context,
        known_variant=known_regulatory_element,
        gene_features=gene_features,
    )
    return _drop_non_designable(_filtered(ctx, "TG02"))


# ---------------------------------------------------------------------------
# TG04 — RNA Processing Modulation
# ---------------------------------------------------------------------------

def rank_rna_processing_mechanisms(
    splice_defect_type: str,
    target_exon: str | None,
    delivery_context: str | None,
    known_variant: str | None,
) -> list[dict]:
    ctx = ArbitrationContext(
        molecular_defect=splice_defect_type,
        delivery_context=delivery_context,
        known_variant=known_variant,
        extras={"targetExon": target_exon},
    )
    return _drop_non_designable(_filtered(ctx, "TG04"))


# ---------------------------------------------------------------------------
# TG03 — RNA Editing / Correction
# ---------------------------------------------------------------------------

# The plan defers TG03: mechanism choice there is near-bijective on the
# variant (A→I for a G>A, C→U for a T>C, trans-splicing for a larger lesion),
# and the hard part is guide design, not mechanism selection. The variant →
# edit-type lookup below is cheap and honest; no arbitration is claimed.
EDIT_TYPE_DEFECT = {
    "a_to_i": "correctable_point_variant",
    "c_to_u": "correctable_point_variant",
    "trans_splicing": "coding_region_lesion",
}


def rank_rna_editing_mechanisms(
    edit_type: str,
    variant_hgvs: str | None,
    enzyme_recruitment: str | None,
    delivery_context: str | None,
    guide_length: int | None,
    mismatch_pocket: str | None,
    max_bystander_edits: int | None,
    exon_count: int | None = None,
    intron_count: int | None = None,
    total_transcripts: int | None = None,
) -> list[dict]:
    ctx = ArbitrationContext(
        molecular_defect=EDIT_TYPE_DEFECT.get(edit_type),
        edit_type=edit_type,
        variant_hgvs=variant_hgvs,
        delivery_context=delivery_context,
        exon_count=exon_count,
        intron_count=intron_count,
        total_transcripts=total_transcripts,
        extras={
            "enzymeRecruitment": enzyme_recruitment,
            "guideLength": guide_length,
            "mismatchPocket": mismatch_pocket,
            "maxBystanderEdits": max_bystander_edits,
        },
    )
    return _drop_non_designable(_filtered(ctx, "TG03"))


# ---------------------------------------------------------------------------
# TG05 — RNA Neutralization
# ---------------------------------------------------------------------------

def rank_rna_neutralization_mechanisms(
    molecular_defect: str,
    neutralization_mode: str,
    repeat_unit: str | None = None,
    estimated_repeat_count: str | None = None,
    steric_chemistry: str | None = None,
    target_rbp: str | None = None,
    oligo_length: int | None = None,
    delivery_context: str | None = None,
    target_gene_type: str | None = None,
) -> list[dict]:
    ctx = ArbitrationContext(
        molecular_defect=molecular_defect,
        transcript_class=target_gene_type,
        delivery_context=delivery_context,
        repeat_unit=repeat_unit,
        repeat_count=estimated_repeat_count,
        oligo_length=oligo_length or 18,
        extras={"stericChemistry": steric_chemistry, "targetRbp": target_rbp},
    )
    return _filtered(
        ctx, "TG05", restrict_to=NEUTRALIZATION_MODE_MECHANISMS.get(
            neutralization_mode, []
        )
    )


# ---------------------------------------------------------------------------
# TG06 — Translational Regulation (retired as a scoring partition)
# ---------------------------------------------------------------------------

def filter_translational_regulation(
    translational_goal: str | None,
    target_element: str | None,
    delivery_context: str | None = None,
    oligo_length: int | None = None,
) -> list[dict]:
    """TG06 display-tag view. There is no TG06 scorer any more.

    A2 belongs to gene silencing, A5 and A6 to gene activation; only A27 is
    uniquely TG06, and it is research-stage with no FDA drug and no clinical
    programme. The (goal, element) pair the page collects is translated into
    the unified defect vocabulary and the shared ranking does the rest.
    """
    defect = TRANSLATIONAL_ELEMENT_DEFECT.get(
        (translational_goal or "", target_element or "")
    )
    ctx = ArbitrationContext(
        molecular_defect=defect,
        delivery_context=delivery_context,
        oligo_length=oligo_length or 18,
    )
    return _drop_non_designable(_filtered(ctx, "TG06"))


# ---------------------------------------------------------------------------
# TG07 — Isoform Engineering (retired as a scoring partition)
# ---------------------------------------------------------------------------

def filter_isoform_engineering(
    isoform_goal: str,
    target_exon_locus: str | None = None,
    splice_element_target: str | None = None,
    delivery_context: str | None = None,
) -> list[dict]:
    """TG07 display-tag view. There is no TG07 scorer any more.

    Every TG07 mechanism is a TG04 mechanism, so this is the TG04 ranking
    filtered to the isoform-engineering tag — by construction it can no
    longer disagree with the RNA-processing page about the same transcript.
    """
    ctx = ArbitrationContext(
        molecular_defect=ISOFORM_GOAL_DEFECT_MAP.get(isoform_goal, isoform_goal),
        delivery_context=delivery_context,
        extras={
            "targetExonLocus": target_exon_locus,
            "spliceElementTarget": splice_element_target,
        },
    )
    return _drop_non_designable(_filtered(ctx, "TG07"))


# ---------------------------------------------------------------------------
# TG09 — Protein Function Modulation (lookup only)
# ---------------------------------------------------------------------------

def lookup_protein_function_modulation() -> dict:
    """Return A25 as rulebook content. No score, no rank.

    TG09 contains exactly one mechanism, and a ranking over a single item is
    not a ranking. A25 (RNA aptamer, pegaptanib) is a real approved drug, but
    aptamer design is structure-selection against a protein surface rather
    than antisense complementarity, so this sequence designer does not design
    it.
    """
    rule = load_rule("A25") or {}
    arb = rule.get("arbitration", {})
    return {
        "mechanismId": "A25",
        "name": rule.get("name"),
        "category": rule.get("category"),
        "status": "LOOKUP",
        "outOfScopeReason": arb.get("nonDesignableReason"),
        "evidenceLevel": rule.get("evidenceLevel"),
        "fdaApprovedDrugs": rule.get("fdaApprovedDrugs"),
        "clinicalTrialExamples": rule.get("clinicalTrialExamples"),
        "molecularDefect": rule.get("molecularDefect"),
        "designRules": rule.get("designRules"),
        "advantages": rule.get("advantages"),
        "limitations": rule.get("limitations"),
        "offTargetConsiderations": rule.get("offTargetConsiderations"),
        "references": rule.get("references", [])[:3],
    }


# ---------------------------------------------------------------------------
# TG08 — Protein Replacement (out of scope)
# ---------------------------------------------------------------------------

def protein_replacement_scope_notice() -> dict:
    """A24 and A26 are not oligonucleotides and are not designed here."""
    return {
        "status": "OUT_OF_SCOPE",
        "mechanisms": [
            {
                "mechanismId": mid,
                "name": (load_rule(mid) or {}).get("name"),
                "reason": (load_rule(mid) or {})
                .get("arbitration", {})
                .get("nonDesignableReason"),
            }
            for mid in ("A24", "A26")
        ],
        "goalNotice": RETIRED_AS_SCORING_PARTITION["TG08"],
    }
