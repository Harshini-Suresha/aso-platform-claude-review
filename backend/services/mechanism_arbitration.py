"""Unified mechanism arbitration.

Scores every designable mechanism in ONE pass against the target, and reports
the therapeutic goal as an OUTPUT LABEL rather than taking it as an input.

WHY THIS EXISTS
---------------
Nine of the twenty-seven mechanisms belong to more than one therapeutic goal.
Because the old design made the user pick a goal *before* anything was
scored, a mechanism living in two goals was scored in two different contexts,
and picking the wrong goal hid the correct answer completely. Nusinersen is
the canonical failure: the therapeutic intent is to raise SMN protein
(upregulation, TG02), the mechanism is splice modulation (TG04), and a user
who selected TG02 never saw exon inclusion at all.

Inverting the routing removes that failure structurally rather than papering
over it, collapses nine duplicate scoring paths into one, and makes the
arbitration claim stronger: choosing among 27 mechanisms spanning genuinely
different strategies is a harder problem than picking among five inside a
goal the user already named.

A goal *filter* may still be applied — but strictly AFTER scoring, for a user
who already knows what they want. It never gates scoring.

WHAT IS AND IS NOT COLLAPSED
----------------------------
Three numbers, three meanings, never multiplied together (plan §3.4):

  applicability   how well the mechanism fits this transcript, as an
                  INTERVAL over the resolved features
  confidence      applicability capped by the weakest provenance behind it
                  and by the rulebook's own evidence rating
  evidence        the rulebook evidence rating, untouched

Ranking is lexicographic over those, so a poorly-evidenced mechanism can
never win on delivery precedent against a better-evidenced one, and nothing
is blended into a single opaque number.

See docs/planning/therapeutic_goal_scope_plan.md.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field

from .feature_service import (
    ABSENT,
    PRESENT,
    PROVENANCE_CAP,
    UNRESOLVED,
    Feature,
    FeatureContext,
    resolve_features,
)

RULEBOOKS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "rulebooks"
)

# ---------------------------------------------------------------------------
# Outcome statuses
# ---------------------------------------------------------------------------

ELIGIBLE = "ELIGIBLE"
HALTED = "HALTED"
REJECTED = "REJECTED"
NOT_DESIGNABLE = "NOT_DESIGNABLE"
OUT_OF_SCOPE = "OUT_OF_SCOPE"
LOOKUP = "LOOKUP"

# Ranking order. ELIGIBLE first; everything else is reported but never
# competes for the top slot. HALTED sorts above REJECTED because "we could
# not establish the evidence" is a different and more actionable answer than
# "this mechanism does not address your defect".
_STATUS_RANK = {
    ELIGIBLE: 0,
    HALTED: 1,
    REJECTED: 2,
    LOOKUP: 3,
    NOT_DESIGNABLE: 4,
    OUT_OF_SCOPE: 5,
}

# ---------------------------------------------------------------------------
# Unified molecular-defect vocabulary
#
# The old design kept four separate defect vocabularies, one per scored goal.
# Under inverted routing there is one target and one defect, so the four are
# unioned here. Every term keeps its original id — nothing is renamed and no
# stored input becomes invalid.
# ---------------------------------------------------------------------------

MOLECULAR_DEFECTS: dict[str, str] = {
    # from TG01
    "gain_of_function": "Gain-of-function / dominant pathogenic variant",
    "overexpression": "Gene overexpression / oncogene activation",
    "mirna_dysregulation": "Pathogenic microRNA dysregulation",
    "viral_toxic_rna": "Viral RNA / toxic transcript",
    "therapeutic_reduction": (
        "Normal (non-mutant) protein whose reduction is therapeutically "
        "beneficial"
    ),
    # from TG02
    "haploinsufficiency": "Haploinsufficiency / reduced gene dosage (general)",
    "poison_exon_inclusion": (
        "Deep intronic or splice-regulatory variant causing poison exon inclusion"
    ),
    "nat_mediated_repression": (
        "A validated disease-associated natural antisense transcript (NAT) "
        "repressing the gene"
    ),
    "uorf_mediated_repression": (
        "A validated inhibitory upstream ORF (uORF) limiting translation"
    ),
    "mirna_mediated_repression": (
        "A validated pathogenic microRNA binding site repressing the target "
        "transcript"
    ),
    "rbp_mediated_repression": (
        "A validated RNA-binding protein (RBP) repressor bound to the target "
        "transcript, limiting translation or stability"
    ),
    "epigenetic_promoter_silencing": (
        "Epigenetic silencing or promoter dysfunction reducing transcription"
    ),
    # from TG04
    "exon_skipping_mutation": (
        "Exon-skipping mutation (frameshift / nonsense in target exon)"
    ),
    "exon_inclusion_defect": (
        "Exon-inclusion defect (exon not recognized by spliceosome)"
    ),
    "cryptic_splice_site": "Cryptic splice-site activation (aberrant donor/acceptor)",
    "pseudoexon_activation": "Deep-intronic pseudoexon activation",
    "apa_dysregulation": "Alternative polyadenylation (APA) dysregulation",
    # from TG05
    "toxic_rna_gain_of_function": (
        "Toxic RNA gain-of-function (expanded repeats / RNA foci)"
    ),
    "rbp_sequestration": "RNA-binding protein sequestration by toxic RNA",
    # from TG03. The editing goal had no defect vocabulary of its own — it
    # gated on an edit-type dropdown — so these two terms were transcribed
    # from the six editing rulebooks' molecularDefect fields when the
    # per-goal vocabularies were unioned. Without them the editing
    # mechanisms declare no defect gate and are eligible for every input.
    "correctable_point_variant": (
        "Single-nucleotide pathogenic variant correctable at the RNA level"
    ),
    "coding_region_lesion": (
        "Coding-region mutation where replacing part of the transcript is "
        "preferable to degradation or exon skipping"
    ),
    # from A27's own molecularDefect field. TG06 gated on a (goal, element)
    # pair rather than a defect, so this term had no home in the old
    # per-goal vocabularies and had to be added when they were unioned.
    "structured_element_dysregulation": (
        "Structured RNA element (IRES / G-quadruplex / riboswitch) aberrantly "
        "regulating translation"
    ),
}

# Terms that meant the same thing in two different per-goal vocabularies.
# Unioning the vocabularies would otherwise make a user who entered one of
# these invisible to a mechanism gated on the other. Each alias is a genuine
# synonym, not a convenience merge:
#
#   pathogenic_mirna / mirna_dysregulation
#       Both denote a pathogenic miRNA driving disease, and both routed to
#       A12 in the old code.
#   loss_of_function / haploinsufficiency
#       TG05's own label for the term was "Pure loss-of-function
#       (haploinsufficiency / null)". Its only job there was to suppress every
#       TG05 mechanism and redirect to gene activation — which is now what
#       falls out of the defect gates on their own.
DEFECT_ALIASES: dict[str, str] = {
    "pathogenic_mirna": "mirna_dysregulation",
    "loss_of_function": "haploinsufficiency",
}


def canonical_defect(defect: str | None) -> str | None:
    if not defect:
        return None
    return DEFECT_ALIASES.get(defect, defect)


# ---------------------------------------------------------------------------
# Evidence and delivery
# ---------------------------------------------------------------------------

EVIDENCE_WEIGHT = {
    "very high": 6,
    "high": 5,
    "moderate-high": 4,
    "moderate": 3,
    "low-moderate": 2,
    "low": 1,
}

# Confidence ceiling implied by the rulebook's own evidence rating, applied
# uniformly to every mechanism at that tier rather than hand-set per
# mechanism. This is what stops a Low–Moderate, no-FDA-drug mechanism (A15,
# A27) from presenting as confidently as a mechanism with five approved
# drugs behind it.
#
# PENDING SIGN-OFF (SO-TG-04). The plan raises "what ceiling does a
# Low–Moderate, no-FDA-drug mechanism get, and does it apply to every
# mechanism at that tier?" as an open question. The answer implemented here
# is "yes, uniformly, derived from the rating" — the specific numbers are a
# defensible default, not a settled decision, and they affect presentation
# only: they never change which mechanisms are eligible.
EVIDENCE_CAP = {
    "very high": 0.95,
    "high": 0.90,
    "moderate-high": 0.80,
    "moderate": 0.70,
    "low-moderate": 0.55,
    "low": 0.40,
}

DELIVERY_CONTEXTS = {
    "cns": "CNS / intrathecal",
    "systemic": "Systemic / subcutaneous",
    "liver": "Liver-targeted",
    "local_intramuscular": "Local / intramuscular",
    "ocular": "Ocular",
    "skin": "Skin / intradermal",
    "other": "Other / not yet determined",
}

# Verified against a real approved drug or published trial. Cells we have not
# personally verified are deliberately ABSENT and default to "unestablished"
# — never backfilled with a guess.
DELIVERY_PRECEDENT: dict[str, dict[str, dict[str, str]]] = {
    "A1": {
        "cns": {"tier": "approved", "citation": "Nusinersen (Spinraza), intrathecal"},
        "liver": {
            "tier": "approved",
            "citation": "Inotersen (Tegsedi), subcutaneous, hepatic uptake",
        },
    },
    "A21": {
        "liver": {
            "tier": "approved",
            "citation": "Patisiran (Onpattro) / givosiran (Givlaari), hepatic",
        },
        "skin": {
            "tier": "trial",
            "citation": (
                "TD101 siRNA, intradermal, Phase 1b (Leachman et al. 2010, "
                "pachyonychia congenita)"
            ),
        },
    },
    "A14": {
        "local_intramuscular": {
            "tier": "approved",
            "citation": "Eteplirsen (Exondys 51)",
        },
    },
}

DELIVERY_TIER_WEIGHT = {
    "approved": 3,
    "trial": 2,
    "unestablished": 0,
    "contraindicated": -1,
}

THERAPEUTIC_GOALS_PATH = os.path.join(RULEBOOKS_DIR, "therapeutic-goals.json")

# Goals that are no longer scoring partitions. Their mechanisms all remain
# available; the goal survives only as a display grouping (plan §3.1–§3.4).
RETIRED_AS_SCORING_PARTITION = {
    "TG06": (
        "Retired as a scoring partition: three of its four mechanisms (A2, A5, "
        "A6) belong to gene silencing or gene activation, and the fourth (A27) "
        "is research-stage. All four remain available and carry a "
        "'translational regulation' display tag."
    ),
    "TG07": (
        "Retired as a scoring partition: every TG07 mechanism (A7, A8, A9, A10) "
        "is also a TG04 mechanism, so two scoring paths over an identical "
        "mechanism set could only ever diverge. 'Isoform engineering' survives "
        "as a display tag."
    ),
    "TG08": (
        "Out of scope for this designer: mRNA (A24) and circRNA (A26) "
        "replacement are kilobase-scale transcripts, not oligonucleotides. "
        "The rulebooks are retained as reference content."
    ),
    "TG09": (
        "Demoted to a direct lookup: TG09 contains one mechanism (A25), and a "
        "ranking over a single item is not a ranking."
    ),
}


# ---------------------------------------------------------------------------
# Rulebook loading
# ---------------------------------------------------------------------------

_RULE_CACHE: dict[str, dict] = {}


def load_rule(mechanism_id: str) -> dict | None:
    if mechanism_id in _RULE_CACHE:
        return _RULE_CACHE[mechanism_id]
    path = os.path.join(RULEBOOKS_DIR, mechanism_id, "rule.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        rule = json.load(f)
    _RULE_CACHE[mechanism_id] = rule
    return rule


def all_mechanism_ids() -> list[str]:
    """Every rulebook on disk, in numeric order.

    A22 is absent and always has been — see
    docs/planning/therapeutic_goal_scope_plan_implementation.md. The ordering
    below does not assume a contiguous ID range.
    """
    ids = [
        d
        for d in os.listdir(RULEBOOKS_DIR)
        if d.startswith("A")
        and os.path.isdir(os.path.join(RULEBOOKS_DIR, d))
        and d[1:].isdigit()
    ]
    return sorted(ids, key=lambda x: int(x[1:]))


def therapeutic_goals() -> dict:
    with open(THERAPEUTIC_GOALS_PATH, encoding="utf-8") as f:
        return json.load(f)


def _evidence_rating(rule: dict) -> str:
    rating = (rule.get("evidenceLevel") or {}).get("rating") or ""
    return rating.split("(")[0].strip().rstrip(".").replace("–", "-").lower()


def _evidence_weight(rule: dict) -> int:
    return EVIDENCE_WEIGHT.get(_evidence_rating(rule), 0)


def _evidence_cap(rule: dict) -> float:
    # An unrecognised rating is not treated as "no ceiling". Falling back to
    # the lowest cap keeps an unparseable rulebook from presenting as more
    # confident than a well-evidenced mechanism.
    return EVIDENCE_CAP.get(_evidence_rating(rule), min(EVIDENCE_CAP.values()))


def _delivery_precedent(
    mechanism_id: str, delivery_context: str | None
) -> tuple[str | None, str | None]:
    if not delivery_context:
        return None, None
    cell = DELIVERY_PRECEDENT.get(mechanism_id, {}).get(delivery_context)
    if not cell:
        return "unestablished", None
    return cell["tier"], cell.get("citation")


def _delivery_rationale(tier: str | None, citation: str | None) -> str:
    if tier == "approved":
        return f"Delivery fit: Approved precedent — {citation}"
    if tier == "trial":
        return f"Delivery fit: Clinical trial precedent — {citation}"
    if tier == "contraindicated":
        return f"Delivery fit: Documented barrier against this route — {citation}"
    return "Delivery fit: No established precedent for this combination"


# ---------------------------------------------------------------------------
# Applicability interval
# ---------------------------------------------------------------------------

def applicability_interval(
    required: list[Feature], forbidden: list[Feature]
) -> tuple[float, float]:
    """Fréchet–Hoeffding bounds over the contributing features.

        lower = max(0, Σ p − (n − 1))
        upper = min(p)

    These hold for ANY dependence structure, so no independence assumption is
    made anywhere. A forbidden feature enters as (1 − p) on the same footing.

    With no contributing features the interval is [1, 1]: nothing is known to
    reduce applicability. That is deliberately vacuous, and the caller must
    read `standIn` / provenance to see how little is actually behind it.
    """
    terms = [f.probability or 0.0 for f in required]
    terms += [1.0 - (f.probability or 0.0) for f in forbidden]
    if not terms:
        return 1.0, 1.0
    n = len(terms)
    lower = max(0.0, sum(terms) - (n - 1))
    upper = min(terms)
    return round(lower, 4), round(upper, 4)


# ---------------------------------------------------------------------------
# Context
# ---------------------------------------------------------------------------

@dataclass
class ArbitrationContext:
    """Inputs to a single arbitration run.

    Note the absence of a therapeutic goal. `goal_filter` exists, but it is
    applied to the finished ranking, never to what gets scored.
    """

    gene_symbol: str = ""
    molecular_defect: str | None = None
    allele_selective: bool | None = None
    transcript_class: str | None = None
    edit_type: str | None = None
    exon_count: int | None = None
    intron_count: int | None = None
    total_transcripts: int | None = None
    delivery_context: str | None = None
    known_variant: str | None = None
    variant_hgvs: str | None = None
    gene_features: dict | None = None
    transcript_sequence: str | None = None
    cds_start: int | None = None
    repeat_unit: str | None = None
    repeat_count: str | None = None
    oligo_length: int = 18
    goal_filter: list[str] | None = None
    extras: dict = field(default_factory=dict)

    def to_feature_context(self) -> FeatureContext:
        return FeatureContext(
            gene_symbol=self.gene_symbol,
            molecular_defect=canonical_defect(self.molecular_defect),
            known_variant=self.known_variant,
            variant_hgvs=self.variant_hgvs,
            transcript_class=self.transcript_class,
            gene_features=self.gene_features,
            transcript_sequence=self.transcript_sequence,
            cds_start=self.cds_start,
            repeat_unit=self.repeat_unit,
            repeat_count=self.repeat_count,
            oligo_length=self.oligo_length,
        )


# ---------------------------------------------------------------------------
# Gates
# ---------------------------------------------------------------------------

def parse_hgvs_substitution(variant_hgvs: str | None) -> tuple[str, str] | None:
    """Pull (ref, alt) out of an HGVS substitution like c.82G>A.

    Handles DNA and RNA base letters. Non-substitution variants (del / ins /
    delins) return None — those cannot be base-classified.
    """
    if not variant_hgvs:
        return None
    match = re.search(
        r"(?<![ACGTUacgtu])([ACGTUacgtu])\s*>\s*([ACGTUacgtu])(?![ACGTUacgtu])",
        variant_hgvs,
    )
    if not match:
        return None
    ref, alt = match.group(1).upper(), match.group(2).upper()
    return ("U" if ref in "TU" else ref), ("U" if alt in "TU" else alt)


def _editing_base_gate(arb: dict, sub: tuple[str, str]) -> str | None:
    """RNA editing acts on the CURRENT (mutant) base in the transcript.

    ADAR deaminates an adenosine (A→I, read as G), so the mutant base must be
    A — i.e. a G>A variant. APOBEC deaminates a cytidine (C→U), so the mutant
    base must be C — i.e. a T>C variant. Trans-splicing replaces a whole
    segment and is not base-restricted.

    This is the one place where TG03 arbitration is more than a lookup on the
    edit-type dropdown, which is why it survives the unification unchanged.
    """
    edit_types = arb.get("editTypes") or []
    ref, alt = sub
    if "a_to_i" in edit_types and alt != "A":
        return (
            f"Variant {ref}>{alt} is not an adenosine alteration — ADAR cannot "
            "repair it (A→I editing requires the mutant base to be A, e.g. a "
            "G>A transition)."
        )
    if "c_to_u" in edit_types and alt != "C":
        return (
            f"Variant {ref}>{alt} is not editable by C→U deamination — APOBEC "
            "requires the mutant base to be C (e.g. a T>C transition)."
        )
    return None


def _check_gates(
    mid: str, arb: dict, ctx: ArbitrationContext
) -> tuple[bool, list[str]]:
    """Hard eligibility gates. A gate failure REJECTS; it never produces a
    low score (plan §3.2, Session 4 §3).

    Every gate below is declared in the mechanism's own rule.json, which is
    where the four central compatibility tables moved to.
    """
    reasons: list[str] = []
    defect = canonical_defect(ctx.molecular_defect)

    declared = arb.get("defectClasses") or []
    if defect and declared and defect not in declared:
        reasons.append(
            f"Does not address the '{MOLECULAR_DEFECTS.get(defect, defect)}' "
            f"molecular defect."
        )

    allele = arb.get("alleleSelective")
    if ctx.allele_selective and allele is False:
        reasons.append(
            "Not described as supporting allele-selective silencing; this "
            "mechanism cannot spare the wild-type allele."
        )

    excluded = arb.get("excludedTranscriptClasses") or []
    if ctx.transcript_class:
        cls = ctx.transcript_class.lower()
        for bad in excluded:
            if cls.startswith(bad.split("_")[0]):
                reasons.append(
                    f"Target is {ctx.transcript_class}; this mechanism does "
                    f"not act on {bad.replace('_', ' ')} transcripts."
                )
                break

    edit_types = arb.get("editTypes") or []
    if edit_types and ctx.edit_type and ctx.edit_type not in edit_types:
        reasons.append(
            f"Does not perform the '{ctx.edit_type}' edit."
        )

    if edit_types:
        sub = parse_hgvs_substitution(ctx.variant_hgvs)
        if sub:
            base_reason = _editing_base_gate(arb, sub)
            if base_reason:
                reasons.append(base_reason)

    if arb.get("requiresIntrons"):
        single_exon = (ctx.exon_count is not None and ctx.exon_count <= 1) or (
            ctx.intron_count == 0
        )
        if single_exon:
            reasons.append(
                "Gene appears to be single-exon / intronless — this mechanism "
                "relies on spliceosomal intron junctions."
            )

    if ctx.total_transcripts is not None and ctx.total_transcripts <= 0:
        reasons.append(
            "No RNA transcripts detected for this gene — there is nothing to "
            "target."
        )

    return (not reasons), reasons


# ---------------------------------------------------------------------------
# The arbitration
# ---------------------------------------------------------------------------

def arbitrate(ctx: ArbitrationContext) -> dict:
    """Score every mechanism in one pass and return the full picture."""
    features = resolve_features(ctx.to_feature_context())
    results = [_score_mechanism(mid, ctx, features) for mid in all_mechanism_ids()]
    results = [r for r in results if r is not None]
    results.sort(key=_sort_key)

    filtered = results
    applied_filter = None
    if ctx.goal_filter:
        applied_filter = list(ctx.goal_filter)
        wanted = set(applied_filter)
        filtered = [r for r in results if wanted & set(r["goalTags"])]

    eligible = [r for r in filtered if r["status"] == ELIGIBLE]
    top = eligible[0] if eligible else None

    return {
        "geneSymbol": ctx.gene_symbol.strip().upper(),
        # The goal is reported, not requested. This is the whole point of the
        # inversion: it is derived from whichever mechanism won.
        "therapeuticGoal": top["primaryGoal"] if top else None,
        "therapeuticGoalName": top["primaryGoalName"] if top else None,
        "goalFilterApplied": applied_filter,
        "results": filtered,
        "features": {fid: f.to_dict() for fid, f in sorted(features.items())},
        "summary": _summarise(results, features),
    }


def _score_mechanism(
    mid: str, ctx: ArbitrationContext, features: dict[str, Feature]
) -> dict | None:
    rule = load_rule(mid)
    if not rule:
        return None
    arb = rule.get("arbitration")
    if not arb:
        return None

    goals = therapeutic_goals()
    goal_tags = arb.get("goalTags") or []
    primary = arb.get("primaryGoal")
    rationale: list[str] = []
    status = ELIGIBLE

    delivery_tier, delivery_citation = _delivery_precedent(
        mid, ctx.delivery_context
    )

    # --- platform capability, before anything else ---------------------------
    scoring_mode = arb.get("scoringMode", "scored")
    if scoring_mode == "out_of_scope":
        status = OUT_OF_SCOPE
        rationale.append(arb["nonDesignableReason"])
    elif scoring_mode == "lookup":
        status = LOOKUP
        rationale.append(arb["nonDesignableReason"])
    elif not arb.get("designable", True):
        status = NOT_DESIGNABLE
        rationale.append(arb["nonDesignableReason"])

    required_ids = arb.get("requiredFeatures") or []
    discriminating_ids = arb.get("discriminatingFeatures") or []
    forbidden_ids = arb.get("forbiddenFeatures") or []

    required: list[Feature] = []
    forbidden: list[Feature] = []
    unresolved: list[Feature] = []

    if status == ELIGIBLE:
        # --- hard gates ------------------------------------------------------
        passed, gate_reasons = _check_gates(mid, arb, ctx)
        if not passed:
            status = REJECTED
            rationale.extend(gate_reasons)

    if status == ELIGIBLE:
        # --- required features: unresolved means HALT, never zero ------------
        for fid in required_ids:
            f = features.get(fid)
            if f is None or f.state == UNRESOLVED:
                unresolved.append(f or Feature(id=fid, state=UNRESOLVED))
            else:
                required.append(f)

        if unresolved:
            status = HALTED
            for f in unresolved:
                rationale.append(
                    f"Halted on {f.id}: {f.detail or 'feature could not be established.'}"
                )

    if status == ELIGIBLE:
        # A required feature resolved as genuinely ABSENT is a rejection, not
        # a low score: we looked, and the prerequisite is not there.
        missing = [f for f in required if f.state == ABSENT]
        if missing:
            status = REJECTED
            for f in missing:
                rationale.append(
                    f"Prerequisite not present: {f.detail or f.id}"
                )

    if status == ELIGIBLE:
        for fid in forbidden_ids:
            f = features.get(fid)
            if f is not None and f.state == PRESENT:
                forbidden.append(f)

        # Discriminating features sharpen the ranking when available and are
        # simply skipped when not. They must never halt a mechanism — the F10
        # split (item 8) is a tie-break between A1 and A2, not a gate on
        # either of them.
        for fid in discriminating_ids:
            f = features.get(fid)
            if f is not None and f.state != UNRESOLVED:
                required.append(f)
            elif f is not None:
                rationale.append(
                    f"{fid} not computed — {f.detail} Ranking falls back to "
                    "rulebook evidence for this comparison."
                )

    contributing = required + forbidden
    lower, upper = applicability_interval(required, forbidden)

    evidence_cap = _evidence_cap(rule)
    provenance_cap = min(
        [PROVENANCE_CAP.get(f.provenance or "", 0.0) for f in contributing],
        default=1.0,
    )
    cap = min(evidence_cap, provenance_cap)
    confidence = (round(min(lower, cap), 4), round(min(upper, cap), 4))

    stand_in_only = bool(contributing) and all(f.stand_in for f in contributing)
    if stand_in_only:
        rationale.append(
            "Every feature supporting this mechanism is your own form input "
            "echoed back — no annotation or model has been consulted. Treat "
            "the ranking as a lookup, not an arbitration."
        )
    if status == ELIGIBLE and not contributing:
        rationale.append(
            "No transcript-level evidence was available for or against this "
            "mechanism; it is ranked on its rulebook evidence rating alone."
        )
    if status == ELIGIBLE and not ctx.molecular_defect:
        rationale.append(
            "No molecular defect was supplied, so the defect gate could not "
            "run. This mechanism passed by default, not on evidence."
        )

    if ctx.delivery_context:
        rationale.append(_delivery_rationale(delivery_tier, delivery_citation))

    note = arb.get("note")
    if note:
        rationale.append(note)

    return {
        "id": rule["id"],
        "name": rule["name"],
        "category": rule.get("category"),
        "status": status,
        # `eligible` and `designable` are kept so existing callers and the
        # frontend keep working against the richer `status`.
        "eligible": status == ELIGIBLE,
        "designable": arb.get("designable", True),
        "scoringMode": scoring_mode,
        "goalTags": goal_tags,
        "primaryGoal": primary,
        "primaryGoalName": (goals.get(primary) or {}).get("name"),
        "goalIsScoringPartition": primary not in RETIRED_AS_SCORING_PARTITION,
        "applicability": {"lower": lower, "upper": upper},
        "confidence": {"lower": confidence[0], "upper": confidence[1]},
        "confidenceCap": round(cap, 4),
        "evidenceLevel": rule.get("evidenceLevel"),
        "evidenceWeight": _evidence_weight(rule),
        # Single number retained for callers that need one. It is the
        # applicability upper bound, NOT a blend of applicability, confidence
        # and evidence — those stay separate on purpose.
        "score": upper,
        "standInOnly": stand_in_only,
        "features": {
            "required": [f.to_dict() for f in required],
            "forbidden": [f.to_dict() for f in forbidden],
            "unresolved": [f.to_dict() for f in unresolved],
        },
        "rationale": rationale,
        "deliveryTier": delivery_tier,
        "deliveryCitation": delivery_citation,
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


def _sort_key(result: dict) -> tuple:
    """Lexicographic, never blended.

    Status first, then how well the mechanism fits this transcript, then the
    rulebook evidence rating, then delivery precedent. Each factor only
    breaks ties left by the one before it, so delivery precedent can never
    beat a genuinely better-evidenced mechanism, and applicability can never
    promote a mechanism that failed a gate.
    """
    return (
        _STATUS_RANK.get(result["status"], 9),
        -result["applicability"]["upper"],
        -result["evidenceWeight"],
        -DELIVERY_TIER_WEIGHT.get(result.get("deliveryTier") or "unestablished", 0),
        result["id"],
    )


def _summarise(results: list[dict], features: dict[str, Feature]) -> dict:
    by_status: dict[str, list[str]] = {}
    for r in results:
        by_status.setdefault(r["status"], []).append(r["id"])
    halted = by_status.get(HALTED, [])
    return {
        "byStatus": by_status,
        "scoredMechanisms": len(by_status.get(ELIGIBLE, [])),
        "haltedMechanisms": halted,
        "unresolvedFeatures": sorted(
            fid for fid, f in features.items() if f.state == UNRESOLVED
        ),
        "standInFeatures": sorted(
            fid for fid, f in features.items() if f.stand_in
        ),
        "retiredGoals": RETIRED_AS_SCORING_PARTITION,
    }
