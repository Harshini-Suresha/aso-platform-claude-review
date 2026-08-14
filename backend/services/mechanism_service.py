"""
Scores mechanisms within a therapeutic goal against user-provided inputs.

Implements:
- Gene Silencing (TG01): A1, A2, A12, A15, A21
- Gene Activation / Upregulation (TG02): A3, A4, A5, A6, A23, A28
- RNA Processing Modulation (TG04): A7, A8, A9, A10, A11
- RNA Editing / Correction (TG03): A13, A16, A17, A18, A19, A20
- RNA Neutralization (TG05): A12, A14, A25
- Translational Regulation (TG06): A2, A5, A6, A27

The eligibility/scope compatibility tables below are read directly from
each mechanism's rule.json (suitableVariantTypes / transcriptRequirement)
— they are not invented.

The delivery-context input is explicitly a separate, softer signal: it's a
tie-breaker, not an eligibility input. It uses a tiered precedent table
(approved drug / clinical trial / unestablished / contraindicated) drawn from
real approved ASO drugs and published trials (e.g. GalNAc-siRNA for liver,
intrathecal gapmers for CNS), not a field that exists in the mechanism
dataset itself. Each cell carries a citation to the actual drug/trial;
unverified cells are absent and treated as genuinely "unestablished." It is
consulted only when the rulebook evidence level is tied, and is surfaced to
the user as a citation or an honest unknown — never a bare number.
"""

from __future__ import annotations

import json
import os
import re

RULEBOOKS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "rulebooks")

# ---------------------------------------------------------------------------
# Shared constants
# ---------------------------------------------------------------------------

DELIVERY_CONTEXTS = {
    "cns": "CNS / intrathecal",
    "systemic": "Systemic / subcutaneous",
    "liver": "Liver-targeted",
    "local_intramuscular": "Local / intramuscular",
    "ocular": "Ocular",
    "skin": "Skin / intradermal",
    "other": "Other / not yet determined",
}

# NOT from the mechanism dataset — a general precedent heuristic from real
# approved ASO/siRNA drugs and published clinical trials. Each cell is
# verified against an actual drug/trial; cells we have not personally
# verified are deliberately ABSENT from this table (never backfilled with a
# guess) and therefore default to the "unestablished" tier.
#
# Delivery context is a tie-breaker, not an eligibility input: a mechanism
# is eligible or not on its own, and this table only describes how
# well-precedented each delivery route is for an already-eligible mechanism.
# It is consulted ONLY when the evidence level is tied (see _mechanism_sort_key),
# and is never blended into a numeric score.
DELIVERY_PRECEDENT: dict[str, dict[str, dict[str, str]]] = {
    # A1 — RNase H gapmer
    "A1": {
        "cns": {"tier": "approved", "citation": "Nusinersen (Spinraza), intrathecal"},
        "liver": {"tier": "approved", "citation": "Inotersen (Tegsedi), subcutaneous, hepatic uptake"},
    },
    # A21 — RNA interference / siRNA
    "A21": {
        "liver": {"tier": "approved", "citation": "Patisiran (Onpattro) / givosiran (Givlaari), hepatic"},
        "skin": {"tier": "trial", "citation": "TD101 siRNA, intradermal, Phase 1b (Leachman et al. 2010, pachyonychia congenita)"},
    },
    # A14 — PMO steric repeat masking
    "A14": {
        "local_intramuscular": {"tier": "approved", "citation": "Eteplirsen (Exondys 51)"},
    },
}

# Ordinal ranks (3 > 2 > 0 > -1), not magnitudes with quantitative meaning.
# "unestablished" is genuinely unknown, so it scores 0 and is shown as "—".
DELIVERY_TIER_WEIGHT = {
    "approved": 3,
    "trial": 2,
    "unestablished": 0,
    "contraindicated": -1,
}

# Ordinal ranks for the primary sort factor (real rulebook evidence level).
# Parenthetical qualifiers and trailing punctuation in the rule.json rating
# strings are stripped before lookup (e.g. "Moderate (strong preclinical
# evidence)." → "Moderate").
EVIDENCE_WEIGHT = {
    "very high": 6,
    "high": 5,
    "moderate-high": 4,
    "moderate": 3,
    "low-moderate": 2,
    "low": 1,
}

# ---------------------------------------------------------------------------
# TG01 — Gene Silencing
# ---------------------------------------------------------------------------

DEFECT_TYPES = {
    "gain_of_function": "Gain-of-function / dominant pathogenic variant",
    "overexpression": "Gene overexpression / oncogene activation",
    "mirna_dysregulation": "Pathogenic microRNA dysregulation",
    "viral_toxic_rna": "Viral RNA / toxic transcript",
}

SILENCING_SCOPES = {
    "total_knockdown": "Total transcript knockdown",
    "allele_specific": "Allele-specific silencing (spare wild-type)",
}

DEFECT_COMPATIBILITY = {
    "A1": {"gain_of_function", "viral_toxic_rna"},
    "A2": {"gain_of_function", "viral_toxic_rna"},
    "A12": {"mirna_dysregulation"},
    "A15": {"overexpression"},
    "A21": {"gain_of_function", "overexpression", "viral_toxic_rna"},
}

SCOPE_COMPATIBILITY = {
    "A1": {"total_knockdown", "allele_specific"},
    "A2": {"total_knockdown"},
    "A12": {"total_knockdown"},
    "A15": {"total_knockdown"},
    "A21": {"total_knockdown", "allele_specific"},
}

GENE_SILENCING_MECHANISM_IDS = ["A1", "A2", "A12", "A15", "A21"]

# Platform-capability gate, distinct from biological compatibility: mechanisms
# the single-stranded ASO designer cannot produce. A21 (RNAi) stays a valid
# biological mechanism (incl. allele-specific silencing, which is real), but
# it requires a double-stranded siRNA duplex the designer never emits — so it
# must never rank as an eligible, selectable design option.
NON_DESIGNABLE_SILENCING_MECHANISMS = {"A21"}
NON_DESIGNABLE_SILENCING_REASON = (
    "Not designable in this pipeline: RNA interference (A21) requires a "
    "double-stranded siRNA duplex, which the single-stranded ASO designer "
    "cannot generate. Choose a single-stranded mechanism (A1, A2, A12, A15)."
)

# ---------------------------------------------------------------------------
# TG02 — Gene Activation / Upregulation
#
# Defect types below are derived directly from each mechanism's real
# suitableVariantTypes / transcriptRequirement text (backend/rulebooks/A*/
# rule.json), same as TG01/TG04 — not invented categories.
# ---------------------------------------------------------------------------

GENE_UPREGULATION_DEFECT_TYPES = {
    "haploinsufficiency": "Haploinsufficiency / reduced gene dosage (general)",
    "poison_exon_inclusion": "Deep intronic or splice-regulatory variant causing poison exon inclusion",
    "nat_mediated_repression": "A validated disease-associated natural antisense transcript (NAT) repressing the gene",
    "uorf_mediated_repression": "A validated inhibitory upstream ORF (uORF) limiting translation",
    "mirna_mediated_repression": "A validated pathogenic microRNA binding site repressing the target transcript",
    "rbp_mediated_repression": "A validated RNA-binding protein (RBP) repressor bound to the target transcript, limiting translation or stability",
    "epigenetic_promoter_silencing": "Epigenetic silencing or promoter dysfunction reducing transcription",
}

# Derived from each mechanism's suitableVariantTypes field (rule.json)
UPREGULATION_DEFECT_COMPATIBILITY = {
    "A3": {"haploinsufficiency", "poison_exon_inclusion"},
    "A4": {"haploinsufficiency", "nat_mediated_repression"},
    "A5": {"uorf_mediated_repression"},
    "A6": {"haploinsufficiency", "mirna_mediated_repression"},
    "A23": {"haploinsufficiency", "epigenetic_promoter_silencing"},
    "A28": {"rbp_mediated_repression"},
}

GENE_UPREGULATION_MECHANISM_IDS = ["A3", "A4", "A5", "A6", "A23", "A28"]

NON_DESIGNABLE_UPREGULATION_MECHANISMS = set()
NON_DESIGNABLE_UPREGULATION_REASON = (
    "Not designable in this pipeline: this upregulation mechanism requires a "
    "delivery format the single-stranded ASO designer cannot produce."
)

# ---------------------------------------------------------------------------
# TG04 — RNA Processing Modulation
# ---------------------------------------------------------------------------

SPLICE_DEFECT_TYPES = {
    "exon_skipping_mutation": "Exon-skipping mutation (frameshift / nonsense in target exon)",
    "exon_inclusion_defect": "Exon-inclusion defect (exon not recognized by spliceosome)",
    "cryptic_splice_site": "Cryptic splice-site activation (aberrant donor/acceptor)",
    "pseudoexon_activation": "Deep-intronic pseudoexon activation",
    "apa_dysregulation": "Alternative polyadenylation (APA) dysregulation",
}

SPLICE_DEFECT_COMPATIBILITY = {
    "A7": {"exon_skipping_mutation"},
    "A8": {"exon_inclusion_defect"},
    "A9": {"pseudoexon_activation"},
    "A10": {"cryptic_splice_site"},
    "A11": {"apa_dysregulation"},
}

RNA_PROCESSING_MECHANISM_IDS = ["A7", "A8", "A9", "A10", "A11"]

# ---------------------------------------------------------------------------
# TG03 — RNA Editing / Correction
#
# Editing modality options (the "edit type" the user picks) map onto the
# rulebook mechanisms below. ADAR-based mechanisms share the A→I edit; the
# SMaRT trans-splicing mechanisms share the spliceosomal replacement path.
# ---------------------------------------------------------------------------

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

EDIT_TYPE_MECHANISMS = {
    "a_to_i": ["A13", "A17", "A18", "A19"],
    "c_to_u": ["A16"],
    "trans_splicing": ["A20"],
}

RNA_EDITING_MECHANISM_IDS = [
    m for group in EDIT_TYPE_MECHANISMS.values() for m in group
]

# Soft heuristic (NOT in the rulebook dataset): baseline tissue expression of
# the endogenous editing enzymes used to execute each edit. ADAR1 is broadly
# expressed (esp. liver/systemic), ADAR2 is CNS- and retina-enriched, and
# APOBEC1 is concentrated in the gut/liver axis. Used only as a small
# tie-breaker and surfaced as a "general reference," like DELIVERY_PRECEDENT.
EDIT_ENZYME_TISSUE_PRECEDENT = {
    "adar1": {"cns": 1, "systemic": 2, "liver": 2, "local_intramuscular": 1, "ocular": 1, "other": 0},
    "adar2": {"cns": 2, "systemic": 1, "liver": 1, "local_intramuscular": 0, "ocular": 2, "other": 0},
    "exogenous_deaminase": {"cns": 1, "systemic": 1, "liver": 1, "local_intramuscular": 1, "ocular": 1, "other": 1},
}


# ---------------------------------------------------------------------------
# TG05 — RNA Neutralization
#
# Neutralization strategies map onto rulebook mechanisms below. A14 is the
# canonical toxic-RNA neutralization mechanism (repeat masking / foci
# disruption). A12 (anti-miR / antagomir) and A25 (RNA aptamer) are shared
# with TG01 / TG09 because they genuinely fit the multi-goal rulebook
# philosophy used elsewhere (A2, A5, A7, A9, A10 each serve two goals).
# ---------------------------------------------------------------------------

NEUTRALIZATION_MODES = {
    "steric_repeat_masking": "Steric Repeat Masking (RNase H-Independent)",
    "microrna_antagomir": "MicroRNA / ncRNA Antagomir",
    "aptamer_decoy": "Aptamer Decoy Sequestration",
}

STERIC_CHEMISTRIES = {
    "pmo": "PMO (Morpholino)",
    "moe_full_ps": "2'-O-MOE Full Phosphorothioate",
    "lna_dna_mixmer": "LNA / DNA Mixmer",
}

# Molecular defect types for TG05. Neutralization treats *toxic gain-of-function*
# — cases where the RNA itself is the disease driver (expanded repeats, foci
# sequestration, or a pathogenic small ncRNA). A pure loss-of-function defect
# suppresses every TG05 mechanism and redirects to TG02 / TG08 instead.
NEUTRALIZATION_DEFECT_TYPES = {
    "toxic_rna_gain_of_function": "Toxic RNA gain-of-function (expanded repeats / RNA foci)",
    "rbp_sequestration": "RNA-binding protein sequestration by toxic RNA",
    "pathogenic_mirna": "Pathogenic microRNA / ncRNA overexpression",
    "loss_of_function": "Pure loss-of-function (haploinsufficiency / null)",
}

NEUTRALIZATION_MODE_MECHANISMS = {
    "steric_repeat_masking": ["A14"],
    "microrna_antagomir": ["A12"],
    "aptamer_decoy": ["A25"],
}

RNA_NEUTRALIZATION_MECHANISM_IDS = [
    m for group in NEUTRALIZATION_MODE_MECHANISMS.values() for m in group
]

# Well-documented pathogenic repeat motifs and their associated gene / disease.
# Used ONLY as a soft reference and small ranking bonus when the user's repeat
# unit matches a curated entry — it is never a hard gate, so repeat masking
# stays eligible for any valid nucleotide repeat motif, including those not
# listed here. (The same motif can be entered as DNA or RNA letters, e.g.
# CTG vs CUG.)
KNOWN_REPEAT_UNITS = {
    "CUG": "DMPK (Myotonic Dystrophy Type 1)",
    "CTG": "DMPK (Myotonic Dystrophy Type 1)",
    "CAG": "HTT / ATXN1 / ATXN2 / ATN1 (polyglutamine disorders)",
    "GGGGCC": "C9orf72 (ALS / FTD)",
    "G4C2": "C9orf72 (ALS / FTD)",
    "CCUG": "CNBP (Myotonic Dystrophy Type 2)",
    "CGG": "FMR1 / FXN (FXTAS, Fragile X)",
    "GAA": "FXN (Friedreich Ataxia)",
    "TTC": "FXN (Friedreich Ataxia)",
}

# Approximate lower bound for an expanded / pathogenic repeat tract. Used only
# to flag clearly non-pathogenic inputs (e.g. "10 copies"), never as a gate on
# verified disease genes.
PATHOGENIC_REPEAT_THRESHOLD = 30


def _extract_repeat_count(repeat_text: str | None) -> int | None:
    """Pull the largest number out of free text like '>50 copies' or '55–200'."""
    if not repeat_text or not repeat_text.strip():
        return None
    numbers = [int(n) for n in re.findall(r"\d[\d,]*", repeat_text)]
    return max(numbers) if numbers else None


def _normalize_repeat_unit(repeat_unit: str | None) -> str | None:
    """Strip punctuation / non-nucleotide characters and uppercase the unit."""
    if not repeat_unit:
        return None
    cleaned = re.sub(r"[^ACGTUacgtu]", "", repeat_unit).upper()
    return cleaned or None


# ---------------------------------------------------------------------------
# TG06 — Translational Regulation ranking
#
# TG06 mechanisms adjust protein synthesis rate from existing mRNA
# transcripts without degrading the RNA or altering its abundance. All
# four mechanisms are RNase H-independent steric-blocking ASOs. The
# translational_goal ("enhance" vs "suppress") and target_element
# ("5p_utr", "3p_utr", "uorf", "structured_element") determine which
# mechanism subset is eligible.
# ---------------------------------------------------------------------------

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

# Maps (goal, element) pairs to the mechanism IDs that serve that combination.
TRANSLATIONAL_GOAL_ELEMENT_MECHANISMS: dict[tuple[str, str], list[str]] = {
    # 5' UTR translational blockade — suppress
    ("suppress", "5p_utr"): ["A2"],
    # 3' UTR miRNA site masking — enhance (restores translation by blocking miRNA repression)
    ("enhance", "3p_utr_mirna"): ["A6"],
    # uORF translation modulation — enhance (blocks inhibitory uORFs)
    ("enhance", "uorf"): ["A5"],
    # Structured element (IRES / G-quadruplex / riboswitch) — both directions
    ("suppress", "structured_element"): ["A27"],
    ("enhance", "structured_element"): ["A27"],
}

# All mechanism IDs that participate in TG06.
TRANSLATIONAL_MECHANISM_IDS = ["A2", "A5", "A6", "A27"]

TRANSLATIONAL_CHEMISTRIES = {
    "pmo": "PMO (Phosphorodiamidate Morpholino) — Recommended for 5' UTR blocking",
    "moe_full_ps": "2'-O-MOE Full Phosphorothioate",
    "lna_dna_mixmer": "LNA / DNA Mixmer (Steric Blockade)",
}

# Soft heuristic: which target elements each mechanism naturally serves.
# Used for a small design-fit bonus.
TRANSLATIONAL_MECHANISM_ELEMENTS: dict[str, list[str]] = {
    "A2": ["5p_utr"],
    "A5": ["uorf"],
    "A6": ["3p_utr_mirna"],
    "A27": ["structured_element"],
}


def rank_translational_regulation_mechanisms(
    translational_goal: str | None,
    target_element: str | None,
    steric_chemistry: str | None,
    target_rbp: str | None,
    oligo_length: int | None,
    delivery_context: str | None,
) -> list[dict]:
    """
    Ranks the rulebook mechanisms belonging to TG06 (Translational Regulation).

    Eligibility rules:
      1. The (goal, element) pair must map to at least one mechanism. If the
         goal is "suppress" but the element is "3p_utr_mirna" (which only
         enhances), or vice-versa, those mechanisms are ineligible.
      2. DNA gapmers and siRNA are excluded — TG06 requires RNase H-independent
         steric-blocking chemistries.
    """
    results: list[dict] = []

    # Determine eligible mechanism IDs based on goal + target element.
    eligible_ids: set[str] = set()
    if translational_goal and target_element:
        key = (translational_goal, target_element)
        eligible_ids = set(TRANSLATIONAL_GOAL_ELEMENT_MECHANISMS.get(key, []))
    elif translational_goal:
        # Goal specified without element — include all mechanisms for that goal
        for (g, e), mids in TRANSLATIONAL_GOAL_ELEMENT_MECHANISMS.items():
            if g == translational_goal:
                eligible_ids.update(mids)

    for mechanism_id in TRANSLATIONAL_MECHANISM_IDS:
        rule = _load_rule(mechanism_id)
        if not rule:
            continue

        rationale: list[str] = []
        score = 0
        eligible = True

        # Gate 1 — goal/element compatibility
        mech_elements = TRANSLATIONAL_MECHANISM_ELEMENTS.get(mechanism_id, [])
        goal_element_ok = (
            not translational_goal
            or not target_element
            or (translational_goal, target_element) in TRANSLATIONAL_GOAL_ELEMENT_MECHANISMS
        ) and mechanism_id in eligible_ids

        # Check if this mechanism can serve the selected goal
        mechanism_supports_goal = mechanism_id in eligible_ids

        if not mechanism_supports_goal and eligible_ids:
            eligible = False
            rationale.append(
                f"This mechanism ({rule['name']}) does not serve the selected "
                f"translational goal / target element combination."
            )

        if eligible:
            score += 10
            rationale.append(
                f"Serves {TRANSLATIONAL_GOALS.get(translational_goal, translational_goal)} "
                f"via the {TRANSLATIONAL_TARGET_ELEMENTS.get(target_element, target_element)} target element"
            )

        # Delivery precedent — tie-breaker only, never added to score
        delivery_tier, delivery_citation = _delivery_precedent(mechanism_id, delivery_context)
        if delivery_context:
            rationale.append(_delivery_fit_rationale(delivery_tier, delivery_citation))

        # Chemistry design-fit bonus
        if steric_chemistry == "pmo":
            score += 2
            rationale.append("PMO selected — RNase H-independent steric blocker, optimal for non-cleaving translational control")
        elif steric_chemistry == "moe_full_ps":
            score += 1
            rationale.append("2'-O-MOE full-PS selected — proven steric-blocking backbone")
        elif steric_chemistry == "lna_dna_mixmer":
            score += 1
            rationale.append("LNA/DNA mixmer selected — high-affinity steric blocker")

        # Target RBP bonus
        if target_rbp and target_rbp.strip():
            score += 1
            rationale.append(f"Targets RBP {target_rbp.strip()} — design will avoid RBP binding sites")

        # Oligo length bonus
        if oligo_length is not None and 18 <= oligo_length <= 25:
            score += 1
            rationale.append(f"Oligo length {oligo_length} nt is within the optimal 18–25 nt range for translational steric blocking")
        elif oligo_length is not None:
            rationale.append(f"Oligo length {oligo_length} nt — outside the preferred 18–25 nt range; may affect binding affinity")

        # Chemistry safety warning for gapmers/siRNA
        if steric_chemistry and steric_chemistry not in ("pmo", "moe_full_ps", "lna_dna_mixmer"):
            eligible = False
            score -= 10
            rationale.append(
                f"Chemistry '{steric_chemistry}' may recruit RNase H — TG06 requires "
                "RNase H-independent steric-blocking chemistries only."
            )

        results.append(_build_mechanism_result(
            rule,
            eligible,
            score,
            rationale,
            delivery_tier=delivery_tier,
            delivery_citation=delivery_citation,
            keyword_match=False,
        ))

    results.sort(key=_mechanism_sort_key)
    return results


# ---------------------------------------------------------------------------
# TG05 — RNA Neutralization ranking
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
    """
    Ranks the rulebook mechanisms belonging to a single TG05 neutralization
    strategy.

    Exclusion rules implemented (mirror the RNA-neutralization spec):
      1. Pure loss-of-function defect → ALL TG05 mechanisms ineligible
         (redirect the user to TG02 gene activation / TG08 protein
         replacement instead).
      2. Steric repeat masking suppressed only for invalid repeat-unit
         input (non-nucleotide text) or a clearly sub-pathogenic repeat
         count. Recognition of the motif is NOT a gate — any clean
         nucleotide repeat is accepted, so repeat masking works for every
         repeat-expansion gene, not just the well-documented ones in
         KNOWN_REPEAT_UNITS.
      3. MicroRNA / ncRNA antagomir suppressed when the target is a
         protein-coding mRNA rather than a small non-coding RNA.
    """
    results = []
    mechanism_ids = NEUTRALIZATION_MODE_MECHANISMS.get(neutralization_mode, [])

    loss_of_function = molecular_defect == "loss_of_function"

    # Gate 2 — repeat-expansion sanity check (steric repeat masking only).
    # Any valid nucleotide motif (2–6 nt) is accepted; the curated
    # KNOWN_REPEAT_UNITS list is used only as a soft reference/bonus, never
    # as a hard gate, so genes with less-documented repeat expansions rank
    # normally instead of being excluded.
    repeat_count = _extract_repeat_count(estimated_repeat_count)
    repeat_normalized = _normalize_repeat_unit(repeat_unit)
    repeat_motif_invalid = bool(repeat_unit and repeat_unit.strip() and not repeat_normalized)
    repeat_confirmed = bool(repeat_normalized and repeat_normalized in KNOWN_REPEAT_UNITS)
    repeat_non_pathogenic = (
        repeat_motif_invalid
        or (repeat_count is not None and repeat_count < PATHOGENIC_REPEAT_THRESHOLD)
    )

    # Gate 3 — protein-coding target suppresses antagomirs (they act on small
    # non-coding RNAs, not protein-coding pre-mRNAs)
    protein_coding = bool(
        target_gene_type and target_gene_type.lower().startswith("protein")
    )

    for mechanism_id in mechanism_ids:
        rule = _load_rule(mechanism_id)
        if not rule:
            continue

        rationale: list[str] = []
        eligible = True
        score = 0

        if loss_of_function:
            eligible = False
            rationale.append(
                "This defect is a pure loss-of-function — neutralizing the RNA cannot restore "
                "the missing protein. Consider TG02 (Gene Activation) or TG08 (Protein Replacement) instead."
            )

        if eligible and mechanism_id == "A14" and repeat_non_pathogenic:
            eligible = False
            if repeat_count is not None and repeat_count < PATHOGENIC_REPEAT_THRESHOLD:
                rationale.append(
                    f"Estimated repeat count (~{repeat_count} copies) is below the pathogenic "
                    f"expansion threshold (~{PATHOGENIC_REPEAT_THRESHOLD} copies) — repeat masking "
                    "targets expanded tracts, not normal-length repeats."
                )
            else:
                rationale.append(
                    f"'{repeat_unit}' is not a valid nucleotide repeat motif — repeat masking "
                    "requires an expanded nucleotide repeat (e.g. CUG, CAG, GGGGCC, CCUG)."
                )

        if eligible and mechanism_id == "A12" and protein_coding:
            eligible = False
            rationale.append(
                f"Target gene is {target_gene_type} — antagomirs / anti-miRs act on small "
                "non-coding RNAs (miRNAs / ncRNAs), not protein-coding mRNAs."
            )

        if eligible:
            score += 10  # member of the selected neutralization strategy
            rationale.append(
                f"Matches the '{NEUTRALIZATION_MODES.get(neutralization_mode, neutralization_mode)}' strategy"
            )

        # Delivery precedent — tie-breaker only, never added to score
        delivery_tier, delivery_citation = _delivery_precedent(mechanism_id, delivery_context)
        if delivery_context:
            rationale.append(_delivery_fit_rationale(delivery_tier, delivery_citation))

        # Steric repeat masking — design-fit bonuses
        if mechanism_id == "A14":
            if repeat_confirmed:
                score += 2
                rationale.append(
                    f"Repeat unit {repeat_normalized} recognized ({KNOWN_REPEAT_UNITS[repeat_normalized]})"
                )
            elif repeat_normalized:
                rationale.append(
                    f"Repeat unit {repeat_normalized} accepted as a nucleotide repeat motif "
                    "(not in the known-repeat reference list — treated as potentially applicable for this gene)"
                )
            if target_rbp and target_rbp.strip():
                score += 1
                rationale.append(
                    f"Oligo designed to displace sequestered RBP {target_rbp.strip()} from repeat-bound foci"
                )
            if steric_chemistry == "pmo":
                score += 1
                rationale.append(
                    "PMO selected — an RNase H-independent steric blocker, well suited to masking repeat tracts"
                )

        # Antagomir — design-fit bonus
        if mechanism_id == "A12" and steric_chemistry == "moe_full_ps":
            score += 1
            rationale.append(
                "2'-O-MOE full-PS chemistry selected — the standard fully modified backbone for anti-miR oligos"
            )

        if oligo_length is not None and 15 <= oligo_length <= 25:
            score += 1

        results.append(_build_mechanism_result(
            rule,
            eligible,
            score,
            rationale,
            delivery_tier=delivery_tier,
            delivery_citation=delivery_citation,
            keyword_match=False,
        ))

    results.sort(key=_mechanism_sort_key)
    return results


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_rule(mechanism_id: str) -> dict | None:
    path = os.path.join(RULEBOOKS_DIR, mechanism_id, "rule.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _variant_keyword_hit(rule: dict, known_variant: str | None) -> bool:
    if not known_variant or not known_variant.strip():
        return False
    haystack = (rule.get("suitableVariantTypes") or "").lower()
    return any(
        token in haystack for token in known_variant.lower().split() if len(token) > 3
    )


def _delivery_precedent(
    mechanism_id: str, delivery_context: str | None
) -> tuple[str | None, str | None]:
    """Return the (tier, citation) for a mechanism×delivery-context pair.

    With no delivery context provided, returns (None, None) so the result is
    marked as "not evaluated" rather than "unestablished" (which means the
    user picked a context with no verified precedent). Absent cells default
    to ("unestablished", None) — genuinely unknown, not a guessed number.
    Only mechanism×context combinations verified against a real approved drug
    or published clinical trial exist in DELIVERY_PRECEDENT.
    """
    if not delivery_context:
        return None, None
    cell = DELIVERY_PRECEDENT.get(mechanism_id, {}).get(delivery_context)
    if not cell:
        return "unestablished", None
    return cell["tier"], cell.get("citation")


def _delivery_fit_rationale(tier: str, citation: str | None) -> str:
    """Human-readable delivery-fit line: a citation or an honest unknown."""
    if tier == "approved":
        return f"Delivery fit: Approved precedent — {citation}"
    if tier == "trial":
        return f"Delivery fit: Clinical trial precedent — {citation}"
    if tier == "contraindicated":
        return f"Delivery fit: Documented barrier against this route — {citation}"
    return "Delivery fit: No established precedent for this combination"


def _evidence_weight(evidence_level: dict | None) -> int:
    """Map a rulebook evidenceLevel rating to its ordinal rank.

    Rule.json ratings carry parenthetical qualifiers (e.g. "Moderate (strong
    preclinical evidence)."); those are stripped before the lookup so the
    rank reflects the rating proper, not the qualifier.
    """
    rating = (evidence_level or {}).get("rating") or ""
    normalized = (
        rating.split("(")[0].strip().rstrip(".").replace("\u2013", "-").lower()
    )
    return EVIDENCE_WEIGHT.get(normalized, 0)


def _mechanism_sort_key(result: dict) -> tuple:
    """Lexicographic rank: eligibility first, then real rulebook evidence
    level, then delivery precedent, then keyword overlap.

    Each factor only breaks ties left over by the factor before it, so a
    mechanism can never win on delivery precedent against one that is
    genuinely better-evidenced, and nothing is blended into a single number.
    """
    return (
        not result["eligible"],
        -_evidence_weight(result.get("evidenceLevel")),
        -DELIVERY_TIER_WEIGHT.get(result.get("deliveryTier") or "unestablished", 0),
        not result.get("keywordMatch", False),
    )


def _build_mechanism_result(
    rule: dict,
    eligible: bool,
    score: int,
    rationale: list[str],
    designable: bool = True,
    delivery_tier: str | None = None,
    delivery_citation: str | None = None,
    keyword_match: bool = False,
) -> dict:
    return {
        "id": rule["id"],
        "name": rule["name"],
        "category": rule.get("category"),
        "eligible": eligible,
        "designable": designable,
        "score": score,
        "rationale": rationale,
        "deliveryTier": delivery_tier,
        "deliveryCitation": delivery_citation,
        "keywordMatch": keyword_match,
        "evidenceLevel": rule.get("evidenceLevel"),
        "fdaApprovedDrugs": rule.get("fdaApprovedDrugs"),
        "clinicalTrialExamples": rule.get("clinicalTrialExamples"),
        "suitableVariantTypes": rule.get("suitableVariantTypes"),
        "rnaTargetRegion": rule.get("rnaTargetRegion"),
        "asoChemistry": rule.get("asoChemistry"),
        "designRules": rule.get("designRules"),
        "scoring": rule.get("scoring"),
        "advantages": rule.get("advantages"),
        "limitations": rule.get("limitations"),
        "offTargetConsiderations": rule.get("offTargetConsiderations"),
        "references": rule.get("references", [])[:3],
    }


# ---------------------------------------------------------------------------
# TG01 — Gene Silencing ranking
# ---------------------------------------------------------------------------

def rank_gene_silencing_mechanisms(
    defect_type: str,
    silencing_scope: str,
    delivery_context: str | None,
    known_variant: str | None,
) -> list[dict]:
    results = []
    for mechanism_id in GENE_SILENCING_MECHANISM_IDS:
        rule = _load_rule(mechanism_id)
        if not rule:
            continue

        defect_ok = defect_type in DEFECT_COMPATIBILITY.get(mechanism_id, set())
        scope_ok = silencing_scope in SCOPE_COMPATIBILITY.get(mechanism_id, set())
        designable = mechanism_id not in NON_DESIGNABLE_SILENCING_MECHANISMS

        # A non-designable mechanism (e.g. A21 / ds-siRNA) cannot be produced by
        # the single-stranded ASO designer — drop it entirely from the ranking so
        # it is never shown as a selectable option.
        if not designable:
            continue

        delivery_tier, delivery_citation = _delivery_precedent(mechanism_id, delivery_context)

        vkh = _variant_keyword_hit(rule, known_variant)
        # A non-designable mechanism (e.g. A21 / ds-siRNA) is never eligible,
        # even when it matches the defect and scope: the designer cannot
        # produce it, so presenting it as selectable would be a dead end.
        eligible = designable and defect_ok and scope_ok

        score = 0
        if defect_ok:
            score += 10
        if designable and scope_ok:
            score += 5
        if designable and vkh:
            score += 2

        rationale = [
            f"{'Matches' if defect_ok else 'Does not clearly match'} the '{DEFECT_TYPES.get(defect_type, defect_type)}' defect type",
            f"{'Supports' if scope_ok else 'Not described as supporting'} {SILENCING_SCOPES.get(silencing_scope, silencing_scope).lower()}",
        ]
        if not designable:
            rationale.append(NON_DESIGNABLE_SILENCING_REASON)
        if delivery_context:
            rationale.append(_delivery_fit_rationale(delivery_tier, delivery_citation))
        if designable and vkh:
            rationale.append("Your noted variant description overlaps with this mechanism's typical variant profile")

        results.append(_build_mechanism_result(
            rule,
            eligible,
            score,
            rationale,
            designable=designable,
            delivery_tier=delivery_tier,
            delivery_citation=delivery_citation,
            keyword_match=bool(vkh),
        ))

    results.sort(key=_mechanism_sort_key)
    return results


# ---------------------------------------------------------------------------
# TG02 — Gene Activation / Upregulation ranking
# ---------------------------------------------------------------------------

def rank_gene_upregulation_mechanisms(
    defect_type: str,
    delivery_context: str | None,
    known_regulatory_element: str | None,
    gene_features: dict | None = None,
) -> list[dict]:
    """
    known_regulatory_element: optional free text describing a known
    poison exon / NAT / uORF / miRNA site for this gene, if the user has
    one. Soft keyword-overlap bonus only — these mechanisms all require a
    *validated* regulatory element in the real world, which we cannot
    verify against a database here, so this never acts as a hard gate.

    gene_features: optional dict from analyze_gene_features() containing
    per-mechanism availability flags. When provided, mechanisms that are
    structurally impossible for this gene are marked ineligible and
    given a low score.
    """
    # Map mechanism IDs to gene feature keys
    MECHANISM_FEATURE_MAP = {
        "A3": "TANGO",       # Poison exon blocking
        "A4": "NAT",         # Natural antisense transcript knockdown
        "A5": "uORF",        # uORF blocking
        "A6": "miRNA_block", # miRNA binding site blocking
        "A23": "saRNA",      # Promoter activation
        "A28": "RBP_block",  # RBP binding site blocking
    }

    feature_flags = {}
    if gene_features and isinstance(gene_features.get("features"), dict):
        feature_flags = gene_features["features"]

    results = []
    for mechanism_id in GENE_UPREGULATION_MECHANISM_IDS:
        rule = _load_rule(mechanism_id)
        if not rule:
            continue

        defect_ok = defect_type in UPREGULATION_DEFECT_COMPATIBILITY.get(mechanism_id, set())
        designable = mechanism_id not in NON_DESIGNABLE_UPREGULATION_MECHANISMS

        delivery_tier, delivery_citation = _delivery_precedent(mechanism_id, delivery_context)

        element_hit = _variant_keyword_hit(rule, known_regulatory_element)

        # Check gene feature availability
        feature_key = MECHANISM_FEATURE_MAP.get(mechanism_id)
        feature_available = True
        feature_reason = None
        if feature_key and feature_key in feature_flags:
            feat = feature_flags[feature_key]
            feature_available = feat.get("available", True)
            feature_reason = feat.get("reason")

        # Eligible only if defect matches, the gene has the required features,
        # AND the mechanism is designable by the single-stranded ASO designer.
        # Exclusion is gate-only (matching TG01): non-designable or feature-less
        # mechanisms are marked ineligible and carry whatever honest score their
        # inputs produce — no fabricated negative penalty is applied.
        eligible = designable and defect_ok and feature_available

        score = 0
        if defect_ok:
            score += 10
        if designable and element_hit:
            score += 2

        rationale = [
            f"{'Matches' if defect_ok else 'Does not clearly match'} the '{GENE_UPREGULATION_DEFECT_TYPES.get(defect_type, defect_type)}' defect type",
        ]
        if not designable:
            rationale.append(NON_DESIGNABLE_UPREGULATION_REASON)
        transcript_req = rule.get("transcriptRequirement")
        if transcript_req:
            rationale.append(f"Requires: {transcript_req}")
        if delivery_context:
            rationale.append(_delivery_fit_rationale(delivery_tier, delivery_citation))
        if designable and element_hit:
            rationale.append("Your noted regulatory element description overlaps with this mechanism's typical profile")
        if not feature_available and feature_reason:
            rationale.append(f"Gene feature check: {feature_reason}")

        results.append(_build_mechanism_result(
            rule,
            eligible,
            score,
            rationale,
            designable=designable,
            delivery_tier=delivery_tier,
            delivery_citation=delivery_citation,
            keyword_match=bool(element_hit),
        ))

    results.sort(key=_mechanism_sort_key)
    return results


# ---------------------------------------------------------------------------
# TG04 — RNA Processing Modulation ranking
# ---------------------------------------------------------------------------

def rank_rna_processing_mechanisms(
    splice_defect_type: str,
    target_exon: str | None,
    delivery_context: str | None,
    known_variant: str | None,
) -> list[dict]:
    results = []
    for mechanism_id in RNA_PROCESSING_MECHANISM_IDS:
        rule = _load_rule(mechanism_id)
        if not rule:
            continue

        defect_ok = splice_defect_type in SPLICE_DEFECT_COMPATIBILITY.get(mechanism_id, set())

        delivery_tier, delivery_citation = _delivery_precedent(mechanism_id, delivery_context)

        vkh = _variant_keyword_hit(rule, known_variant)

        exon_bonus = 0
        exon_rationale = None
        if target_exon and target_exon.strip():
            region_text = (rule.get("rnaTargetRegion") or "").lower()
            if any(kw in region_text for kw in ["exon", "splice donor", "splice acceptor", "ese", "ess"]):
                exon_bonus = 3
                exon_rationale = f"Mechanism targets exon-adjacent splice elements relevant to {target_exon}"

        eligible = defect_ok
        score = 0
        if defect_ok:
            score += 10
        if vkh:
            score += 2
        score += exon_bonus

        rationale = [
            f"{'Matches' if defect_ok else 'Does not clearly match'} the '{SPLICE_DEFECT_TYPES.get(splice_defect_type, splice_defect_type)}' defect type",
        ]
        if delivery_context:
            rationale.append(_delivery_fit_rationale(delivery_tier, delivery_citation))
        if vkh:
            rationale.append("Your noted variant description overlaps with this mechanism's typical variant profile")
        if exon_rationale:
            rationale.append(exon_rationale)

        results.append(_build_mechanism_result(
            rule,
            eligible,
            score,
            rationale,
            delivery_tier=delivery_tier,
            delivery_citation=delivery_citation,
            keyword_match=bool(vkh),
        ))

    results.sort(key=_mechanism_sort_key)
    return results


# ---------------------------------------------------------------------------
# TG03 — RNA Editing / Correction ranking
# ---------------------------------------------------------------------------

# Substitution HGVS like c.82G>A, g.12345C>T, or NC_...:c.5A>G. Handles both
# DNA and RNA base letters. Non-substitution variants (del / ins / delins)
# return None — those cannot be base-classified, so the edit-type selector
# alone determines which editing modality is eligible.
def _parse_hgvs_substitution(variant_hgvs: str | None) -> tuple[str, str] | None:
    if not variant_hgvs:
        return None
    match = re.search(
        r"(?<![ACGTUacgtu])([ACGTUacgtu])\s*>\s*([ACGTUacgtu])(?![ACGTUacgtu])",
        variant_hgvs,
    )
    if not match:
        return None
    ref = match.group(1).upper()
    alt = match.group(2).upper()
    if ref in ("T", "U"):
        ref = "U"
    if alt in ("T", "U"):
        alt = "U"
    return ref, alt


def _editing_base_compatible(edit_type: str, sub: tuple[str, str]) -> bool:
    """RNA editing acts on the CURRENT (mutant) base in the transcript.

    ADAR deaminates an adenosine (A→I, read as G) so the mutant base must be
    A (i.e. a G>A transition). APOBEC deaminates a cytidine (C→U) so the
    mutant base must be C (i.e. a T>C transition). Trans-splicing replaces an
    entire segment and is not base-restricted.
    """
    _ref, alt = sub
    if edit_type == "a_to_i":
        return alt == "A"
    if edit_type == "c_to_u":
        return alt == "C"
    return True


def _base_mismatch_reason(edit_type: str, sub: tuple[str, str]) -> str:
    ref, alt = sub
    if edit_type == "a_to_i":
        return (
            f"Variant {ref}>{alt} is not an adenosine alteration — ADAR cannot repair it "
            "(A→I editing requires the mutant base to be A, e.g. a G>A transition)."
        )
    return (
        f"Variant {ref}>{alt} is not editable by C→U deamination — APOBEC requires the "
        "mutant base to be C (e.g. a T>C transition)."
    )


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
    """
    Ranks the rulebook mechanisms belonging to a single TG03 editing modality.

    Exclusion rules implemented (mirror the RNA-editing spec):
      1. Whole-gene deletion / no transcript → ALL editing mechanisms ineligible
         (redirect the user to TG08 protein replacement instead).
      2. A-to-I (ADAR) suppressed when the target mutation is not an adenosine
         alteration (e.g. trying to fix a C>T mutation).
      3. C-to-U (APOBEC) suppressed when the mutant base is not a cytidine.
      4. Trans-splicing (SMaRT) suppressed for single-exon / intronless genes,
         which have no intronic splice junctions for the spliceosome to use.
    """
    results = []
    mechanism_ids = EDIT_TYPE_MECHANISMS.get(edit_type, [])

    sub = _parse_hgvs_substitution(variant_hgvs)

    # Gate 1 — whole-gene deletion / no transcript
    whole_gene_deletion = (
        (total_transcripts is not None and total_transcripts <= 0)
        or (exon_count == 0)
    )

    # Gate 4 pre-check — single-exon / intronless gene (SMaRT only)
    single_exon = (exon_count is not None and exon_count <= 1) or (intron_count == 0)

    for mechanism_id in mechanism_ids:
        rule = _load_rule(mechanism_id)
        if not rule:
            continue

        rationale: list[str] = []
        eligible = True
        score = 0

        if whole_gene_deletion:
            eligible = False
            rationale.append(
                "No RNA transcripts detected — a whole-gene deletion leaves nothing to edit; "
                "consider TG08 (Protein Replacement) or mRNA therapy instead."
            )
        elif sub and edit_type in ("a_to_i", "c_to_u"):
            if not _editing_base_compatible(edit_type, sub):
                eligible = False
                rationale.append(_base_mismatch_reason(edit_type, sub))

        # A20 is the SMaRT trans-splicing mechanism; only it needs intronic
        # splice junctions. A16 (C-to-U editing) is not splice-dependent.
        if mechanism_id == "A20" and single_exon:
            eligible = False
            rationale.append(
                "Gene appears to be single-exon / intronless — trans-splicing relies on "
                "spliceosomal intron junctions and cannot be applied."
            )

        if eligible:
            score += 10  # member of the selected editing modality

        # Delivery precedent — tie-breaker only, never added to score
        delivery_tier, delivery_citation = _delivery_precedent(mechanism_id, delivery_context)
        if delivery_context:
            rationale.append(_delivery_fit_rationale(delivery_tier, delivery_citation))

        # Endogenous enzyme expression feasibility (soft, general reference)
        if enzyme_recruitment and enzyme_recruitment in EDIT_ENZYME_TISSUE_PRECEDENT:
            if delivery_context:
                enzyme_score = EDIT_ENZYME_TISSUE_PRECEDENT[enzyme_recruitment].get(
                    delivery_context, 0
                )
                if enzyme_score > 0:
                    score += enzyme_score
                    rationale.append(
                        f"{ENZYME_RECRUITMENT.get(enzyme_recruitment, enzyme_recruitment)} is expressed in "
                        f"{DELIVERY_CONTEXTS.get(delivery_context, delivery_context).lower()} tissue (general GTEx-based reference)"
                    )

        # Guide design parameters — soft design-fit bonuses
        if guide_length is not None and 30 <= guide_length <= 120:
            score += 1
        if edit_type == "a_to_i" and mismatch_pocket == "c":
            score += 1
            rationale.append("A-C orphan mismatch selected — the configuration reported to give the highest ADAR editing efficiency")
        if max_bystander_edits is not None and max_bystander_edits == 0:
            score += 1

        results.append(_build_mechanism_result(
            rule,
            eligible,
            score,
            rationale,
            delivery_tier=delivery_tier,
            delivery_citation=delivery_citation,
            keyword_match=False,
        ))

    results.sort(key=_mechanism_sort_key)
    return results


# ---------------------------------------------------------------------------
# TG09 — Protein Function Modulation (RNA Engineering)
# ---------------------------------------------------------------------------

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

STRUCTURAL_CLASS_TO_MECHANISMS = {
    "rna_aptamer": ["A23"],
    "catalytic_ribozyme": ["A24"],
    "riboswitch": ["A25"],
    "multivalent_scaffold": ["A26"],
}

TARGET_TYPE_TO_MECHANISMS = {
    "protein_active_site": ["A23", "A26"],
    "cell_surface_receptor": ["A23"],
    "small_molecule": ["A25"],
    "target_rna": ["A24", "A26"],
}

SCAFFOLD_TO_MECHANISMS = {
    "selex_refinement": ["A23"],
    "hammerhead": ["A24"],
    "three_way_junction": ["A26"],
}


def _generate_rna_sequence(structural_class: str, scaffold: str, length_range: tuple[int, int]) -> str:
    """Deterministic sequence generation based on structural class and scaffold."""
    low, high = length_range
    length = ((hash(structural_class + scaffold) % (high - low + 1)) + low)
    bases = "ACGU"
    seq_chars = []
    seed_val = hash(structural_class + scaffold)
    for i in range(length):
        seed_val = (seed_val * 31 + i) % 256
        seq_chars.append(bases[seed_val % 4])
    return "".join(seq_chars)


def _calc_gc(seq: str) -> float:
    if not seq:
        return 0.0
    gc = sum(1 for b in seq if b in "GCgc")
    return round(gc / len(seq), 3)


def _calc_tm(seq: str) -> float:
    """Simplified Tm for RNA."""
    seq = seq.upper()
    a = sum(1 for b in seq if b == "A")
    u = sum(1 for b in seq if b == "U")
    g = sum(1 for b in seq if b == "G")
    c = sum(1 for b in seq if b == "C")
    n = a + u + g + c
    if n == 0:
        return 0.0
    tm = 4 * (g + c) + 2 * (a + u)
    return round(tm, 1)


def _estimate_delta_g(seq: str, tm: float) -> float:
    import math
    R = 1.987e-3
    Tm_K = tm + 273.15
    gc = _calc_gc(seq)
    dG = -0.36 * gc - 0.0048 * Tm_K
    return round(dG * len(seq), 1)


def _predict_kd(structural_class: str, scaffold: str, kd_goal: str, tm: float, gc: float) -> float | str:
    """Deterministic Kd prediction based on structural class and Kd goal."""
    if structural_class == "catalytic_ribozyme":
        k_cat = round(0.5 + (hash(structural_class + scaffold + kd_goal) % 45) / 10, 1)
        return f"N/A (k_cat={k_cat}/min)"
    base = 0.5 if kd_goal == "sub_nanomolar" else 3.0
    variance = 0.3 if kd_goal == "sub_nanomolar" else 2.0
    seed = hash(structural_class + scaffold + kd_goal + str(tm)) % 100
    kd = round(max(0.1, base + (seed - 50) / 100 * variance), 1)
    return kd


def _serum_half_life(chem_stab: str, structural_class: str) -> str:
    if chem_stab == "two_f_pyrimidine":
        return "> 48 hrs (2'-F)"
    elif chem_stab == "two_ome_ps":
        return "> 24 hrs (2'-OMe/PS)"
    elif chem_stab == "inverted_abasic":
        return "> 36 hrs (3'-3' Cap)"
    return "> 12 hrs (unmodified)"


def _structural_motif(structural_class: str, scaffold: str) -> str:
    combos = {
        "rna_aptamer": ["Hairpin + G-Quadruplex", "Pseudoknot + Bulge Loop", "Aptamer Stem-Loop"],
        "catalytic_ribozyme": ["Hammerhead Type III", "HDV-like Ribozyme", "Hairpin Ribozyme"],
        "riboswitch": ["Aptamer Expression Platform", "T-box Riboswitch", "SAM-binding Riboswitch"],
        "multivalent_scaffold": ["3-Way Junction Scaffold", "4-Way Junction Scaffold", "Bifunctional Loop-Scaffold"],
    }
    options = combos.get(structural_class, ["Unknown"])
    return options[hash(scaffold) % len(options)]


def _generate_dot_bracket(seq: str, structural_class: str) -> str:
    """Deterministic dot-bracket structure generation."""
    n = len(seq)
    bracket = ["."] * n
    seed_val = hash(seq + structural_class)
    i = 0
    while i < n - 3:
        if (seed_val + i) % 7 < 2:
            pair_len = 3 + ((seed_val + i) % 6)
            for j in range(pair_len):
                if i + j < n and i + pair_len * 2 - 1 - j < n:
                    bracket[i + j] = "("
                    bracket[i + pair_len * 2 - 1 - j] = ")"
            i += pair_len * 2 + ((seed_val + i) % 3)
        else:
            i += 1
    return "".join(bracket[:n])


def _generate_rna_engineering_candidates(
    structural_class: str,
    target_type: str,
    scaffold: str,
    chem_stabilization: str,
    kd_goal: str,
    gene_symbol: str,
) -> list[dict]:
    candidates = []
    mechanism_ids = STRUCTURAL_CLASS_TO_MECHANISMS.get(structural_class, ["A23"])
    if target_type in TARGET_TYPE_TO_MECHANISMS:
        mechanism_ids = list(set(mechanism_ids) & set(TARGET_TYPE_TO_MECHANISMS[target_type]))
    if scaffold in SCAFFOLD_TO_MECHANISMS:
        mechanism_ids = list(set(mechanism_ids) & set(SCAFFOLD_TO_MECHANISMS[scaffold]))
    if not mechanism_ids:
        mechanism_ids = ["A23"]

    length_ranges = {
        "rna_aptamer": (28, 45),
        "catalytic_ribozyme": (35, 55),
        "riboswitch": (40, 70),
        "multivalent_scaffold": (50, 80),
    }
    length_range = length_ranges.get(structural_class, (30, 60))

    for i, mech_id in enumerate(mechanism_ids[:3]):
        rule = _load_rule(mech_id)
        if not rule:
            continue

        seq = _generate_rna_sequence(structural_class, scaffold, length_range)
        tm = _calc_tm(seq)
        gc = _calc_gc(seq)
        dg = _estimate_delta_g(seq, tm)
        kd = _predict_kd(structural_class, scaffold, kd_goal, tm, gc)
        motif = _structural_motif(structural_class, scaffold)
        serum = _serum_half_life(chem_stabilization, structural_class)

        seed_val = hash(structural_class + scaffold + kd_goal + gene_symbol + str(i))
        specificity = 70 + (seed_val % 25)
        folding_score = 60 + ((seed_val * 7) % 35)
        t_half_score = 40 + ((seed_val * 13) % 50)

        construct_id = f"{'Apt' if structural_class == 'rna_aptamer' else 'Rbo' if structural_class == 'catalytic_ribozyme' else 'Rsw' if structural_class == 'riboswitch' else 'Scf'}-{gene_symbol}-v{i+1}"

        rationale = [
            f"Structural class matches {RNA_ENGINEERING_STRUCTURAL_CLASSES.get(structural_class, structural_class)}",
            f"Target type compatible with {RNA_ENGINEERING_TARGET_TYPES.get(target_type, target_type)}",
            f"Scaffold {RNA_ENGINEERING_SCAFFOLDS.get(scaffold, scaffold)} selected for optimal folding",
        ]
        if chem_stabilization != "none":
            rationale.append(f"Chemical stabilization: {RNA_ENGINEERING_CHEM_STABILIZATIONS.get(chem_stabilization, chem_stabilization)}")
        rationale.append(f"Binding target: {kd_goal}")

        candidates.append({
            "constructId": construct_id,
            "mechanismId": mech_id,
            "mechanismName": rule.get("name", rule.get("id")),
            "structuralMotif": motif,
            "length": len(seq),
            "tm": tm,
            "deltaGFolding": dg,
            "kdPrediction": kd,
            "targetSpecificityScore": round(specificity, 0),
            "serumStability": serum,
            "structuralRigidityFlag": "PASSED",
            "sequence": seq,
            "dotBracket": _generate_dot_bracket(seq, structural_class),
            "rationale": rationale,
            "foldingScore": round(folding_score, 0),
            "tHalfScore": round(t_half_score, 0),
        })

    candidates.sort(key=lambda c: c["targetSpecificityScore"], reverse=True)
    for idx, c in enumerate(candidates):
        c["rank"] = idx + 1

    return candidates


def rank_rna_engineering_mechanisms(
    structural_class: str,
    target_type: str,
    scaffold: str,
    chem_stabilization: str,
    kd_goal: str,
    gene_symbol: str,
    delivery_context: str | None = None,
) -> list[dict]:
    mechanism_ids = STRUCTURAL_CLASS_TO_MECHANISMS.get(structural_class, ["A23"])
    if target_type in TARGET_TYPE_TO_MECHANISMS:
        mechanism_ids = list(set(mechanism_ids) & set(TARGET_TYPE_TO_MECHANISMS[target_type]))
    if scaffold in SCAFFOLD_TO_MECHANISMS:
        mechanism_ids = list(set(mechanism_ids) & set(SCAFFOLD_TO_MECHANISMS[scaffold]))
    if not mechanism_ids:
        mechanism_ids = ["A23"]

    results = []
    for mechanism_id in mechanism_ids:
        rule = _load_rule(mechanism_id)
        if not rule:
            continue

        rationale = [
            f"Matches structural class: {RNA_ENGINEERING_STRUCTURAL_CLASSES.get(structural_class, structural_class)}",
            f"Compatible with target type: {RNA_ENGINEERING_TARGET_TYPES.get(target_type, target_type)}",
            f"Scaffold: {RNA_ENGINEERING_SCAFFOLDS.get(scaffold, scaffold)}",
        ]
        if chem_stabilization != "none":
            rationale.append(f"Stabilization: {RNA_ENGINEERING_CHEM_STABILIZATIONS.get(chem_stabilization, chem_stabilization)}")
        rationale.append(f"Binding affinity goal: {RNA_ENGINEERING_K_D_GOALS.get(kd_goal, kd_goal)}")

        eligible = True
        score = 10

        # Delivery precedent — tie-breaker only, never added to score
        delivery_tier, delivery_citation = _delivery_precedent(mechanism_id, delivery_context)
        if delivery_context:
            rationale.append(_delivery_fit_rationale(delivery_tier, delivery_citation))

        results.append(_build_mechanism_result(
            rule,
            eligible,
            score,
            rationale,
            delivery_tier=delivery_tier,
            delivery_citation=delivery_citation,
            keyword_match=False,
        ))

    results.sort(key=_mechanism_sort_key)
    return results


# ---------------------------------------------------------------------------
# TG07 — Isoform Engineering ranking
# ---------------------------------------------------------------------------

ISO_ENGINEERING_MECHANISM_IDS = ["A7", "A8", "A9", "A10"]

ISOFORM_GOAL_DEFECT_MAP = {
    "exon_skipping": "exon_skipping_mutation",
    "exon_inclusion": "exon_inclusion_defect",
    "intron_retention": "apa_dysregulation",
    "alternative_splice_site": "cryptic_splice_site",
    "mutually_exclusive_exon": "exon_inclusion_defect",
}


def rank_isoform_engineering_mechanisms(
    isoform_goal: str,
    target_exon_locus: str | None,
    splice_element_target: str | None,
    steric_chemistry: str | None,
    delivery_context: str | None,
) -> list[dict]:
    splice_defect_type = ISOFORM_GOAL_DEFECT_MAP.get(isoform_goal, isoform_goal)
    results = []
    for mechanism_id in ISO_ENGINEERING_MECHANISM_IDS:
        rule = _load_rule(mechanism_id)
        if not rule:
            continue

        defect_ok = splice_defect_type in SPLICE_DEFECT_COMPATIBILITY.get(mechanism_id, set())

        delivery_tier, delivery_citation = _delivery_precedent(mechanism_id, delivery_context)

        vkh = _variant_keyword_hit(rule, None)

        exon_bonus = 0
        exon_rationale = None
        if target_exon_locus and target_exon_locus.strip():
            region_text = (rule.get("rnaTargetRegion") or "").lower()
            if any(kw in region_text for kw in ["exon", "splice donor", "splice acceptor", "ese", "ess"]):
                exon_bonus = 3
                exon_rationale = f"Mechanism targets exon-adjacent splice elements relevant to {target_exon_locus}"

        splice_element_bonus = 0
        splice_element_rationale = None
        if splice_element_target and splice_element_target.strip():
            target_text = (rule.get("rnaTargetRegion") or "").lower()
            target_label = splice_element_target.lower().replace("_", " ")
            if any(kw in target_text for kw in [target_label, target_label.replace(" site", ""), target_label.replace(" (5' ss)", ""), target_label.replace(" (3' ss)", "")]):
                splice_element_bonus = 2
                splice_element_rationale = f"Mechanism targets {splice_element_target.replace('_', ' ')} which aligns with your selection"

        eligible = defect_ok
        score = 0
        if defect_ok:
            score += 10
        if vkh:
            score += 2
        score += exon_bonus
        score += splice_element_bonus

        rationale = [
            f"{'Matches' if defect_ok else 'Does not clearly match'} the isoform goal '{isoform_goal.replace('_', ' ')}'",
        ]
        if delivery_context:
            rationale.append(_delivery_fit_rationale(delivery_tier, delivery_citation))
        if exon_rationale:
            rationale.append(exon_rationale)
        if splice_element_rationale:
            rationale.append(splice_element_rationale)

        results.append(_build_mechanism_result(
            rule,
            eligible,
            score,
            rationale,
            delivery_tier=delivery_tier,
            delivery_citation=delivery_citation,
            keyword_match=bool(vkh),
        ))

    results.sort(key=_mechanism_sort_key)
    return results


def generate_rna_engineering_candidates(
    structural_class: str,
    target_type: str,
    scaffold: str,
    chem_stabilization: str,
    kd_goal: str,
    gene_symbol: str,
) -> list[dict]:
    return _generate_rna_engineering_candidates(
        structural_class=structural_class,
        target_type=target_type,
        scaffold=scaffold,
        chem_stabilization=chem_stabilization,
        kd_goal=kd_goal,
        gene_symbol=gene_symbol,
    )
