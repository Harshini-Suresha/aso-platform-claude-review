"""L1 evidence-feature layer for mechanism arbitration.

Implements the fixed feature vocabulary from
`docs/planning/scoring_and_ml_plan.md` §3.1 and the gap list in
`docs/planning/therapeutic_goal_scope_plan.md` §6.

WHAT A FEATURE IS
-----------------
A feature is a statement about the *target transcript*, not about the user's
intent. "This transcript contains an NMD-inducing exon" is a feature. "The
user wants to upregulate this gene" is not — that is the therapeutic goal,
which under inverted routing is an output, not an input.

Every feature resolves to a `Feature` carrying:

  state       PRESENT / ABSENT / UNRESOLVED
  probability a number in [0,1], or None when UNRESOLVED
  provenance  how we know it — this is what caps confidence downstream
  source      the specific thing consulted
  stand_in    True when the "source" is really the user's own form input

The two non-negotiables carried over from the plan:

  * An absent feature returns **ABSENT**, never probability zero. ABSENT
    means "we looked and it is not there"; UNRESOLVED means "we have no way
    to look". They are different facts and they must not collapse into the
    same number.
  * A predicted feature and a literature-confirmed feature never enter the
    score identically. That is what `provenance` is for.

THE SOURCE LADDER
-----------------
Each feature declares an ordered ladder of sources. The first rung that
fires wins, and its provenance tier is recorded. Most ladders end in a
`user_asserted` rung: the user's own form input, echoed back. That rung is
marked `stand_in=True` and capped hard, because a mechanism whose evidence
is the dropdown the user just picked has not been *arbitrated* — it has been
looked up. Making that visible in the output is the point; the companion
plan's whole critique of the current TG04 numbers is that the input already
contains the answer.

Two features have a deliberately EMPTY ladder:

  F11 repressive RBP site      → blocks A28
  F13 polyadenylation usage    → blocks A11

Neither has a wired source and neither has a user input that constitutes
evidence about the transcript, so mechanisms requiring them halt rather than
score (plan §6.2, §6.4, checklist item 9). Naming a target RBP in a form
field says which protein you have in mind; it is not evidence that a
repressive site for it exists in this transcript.

F12 (repeat expansion) keeps a user rung because the plan documents the
current input as user-supplied free text that *should become* an annotation
lookup (§5) — so A14 halts only when nothing is supplied at all.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable

# ---------------------------------------------------------------------------
# States and provenance
# ---------------------------------------------------------------------------

PRESENT = "PRESENT"
ABSENT = "ABSENT"
UNRESOLVED = "UNRESOLVED"

# Provenance tiers, strongest first. The cap is the ceiling a mechanism's
# confidence can reach when this is the weakest feature supporting it
# (plan §3.3: quality and reliability stay on separate axes).
#
# The companion plan describes each feature as a triple carrying both an
# evidence tier and a provenance tier. In this implementation the two
# collapse: every rung of every ladder below is distinguished by *where the
# statement came from*, and no second axis had a distinct rule attached to
# it. Carrying an `evidence_tier` field with no rule that reads it would be
# decoration. If a genuine second axis appears later, it belongs here.
MEASURED = "measured"
ANNOTATION = "annotation"
PREDICTED = "predicted"
USER_ASSERTED = "user_asserted"

PROVENANCE_CAP: dict[str, float] = {
    MEASURED: 1.00,
    ANNOTATION: 0.90,
    PREDICTED: 0.75,
    USER_ASSERTED: 0.60,
}

PROVENANCE_LABEL: dict[str, str] = {
    MEASURED: "Experimentally validated for this transcript",
    ANNOTATION: "Genome annotation lookup",
    PREDICTED: "Model prediction",
    USER_ASSERTED: "Supplied by the user on the input form",
}


@dataclass(frozen=True)
class Feature:
    """One resolved feature observation about the target transcript."""

    id: str
    state: str
    probability: float | None = None
    provenance: str | None = None
    source: str | None = None
    stand_in: bool = False
    detail: str | None = None

    @property
    def resolved(self) -> bool:
        return self.state != UNRESOLVED

    @property
    def cap(self) -> float:
        """Confidence ceiling this observation imposes."""
        if self.provenance is None:
            return 0.0
        return PROVENANCE_CAP.get(self.provenance, 0.0)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "label": FEATURE_CATALOG.get(self.id, {}).get("label", self.id),
            "state": self.state,
            "probability": self.probability,
            "provenance": self.provenance,
            "provenanceLabel": PROVENANCE_LABEL.get(self.provenance or ""),
            "source": self.source,
            "standIn": self.stand_in,
            "detail": self.detail,
        }


def _unresolved(fid: str, why: str) -> Feature:
    return Feature(id=fid, state=UNRESOLVED, detail=why)


# ---------------------------------------------------------------------------
# The vocabulary
# ---------------------------------------------------------------------------

FEATURE_CATALOG: dict[str, dict[str, Any]] = {
    "F1": {
        "label": "Exon weakly recognised by spliceosome",
        "intendedSource": "SpliceAI",
        "wired": False,
    },
    "F2": {
        "label": "Variant creates a cryptic splice site",
        "intendedSource": "SpliceAI + MaxEntScan",
        "wired": False,
    },
    "F3": {
        "label": "Deep-intronic pseudoexon activated",
        "intendedSource": "SpliceAI",
        "wired": False,
    },
    "F4": {
        "label": "Transcript contains an NMD-inducing (poison) exon",
        "intendedSource": "GENCODE nonsense_mediated_decay biotype",
        "wired": True,
    },
    "F5": {
        "label": "Repressive uORF in the 5' UTR",
        "intendedSource": "literature-validated uORF list; 5' UTR ORF scan",
        "wired": True,
    },
    "F6": {
        "label": "Overlapping natural antisense transcript",
        "intendedSource": "annotation lookup",
        "wired": True,
    },
    "F7": {
        "label": "Repressive miRNA site in the 3' UTR",
        "intendedSource": "TargetScan context++",
        "wired": False,
    },
    "F8": {
        "label": "Promoter methylated / silenced in the target tissue",
        "intendedSource": "methylation atlas",
        "wired": False,
    },
    "F9": {
        "label": "Allele-distinguishing variant in the transcript",
        "intendedSource": "dbSNP / ClinVar",
        "wired": False,
    },
    "F10a": {
        "label": "Density of accessible designable sites, transcript-wide",
        "intendedSource": "ViennaRNA RNAplfold accessibility",
        "wired": True,
    },
    "F10b": {
        "label": "Density of accessible designable sites, 5' UTR / start codon",
        "intendedSource": "ViennaRNA RNAplfold accessibility",
        "wired": True,
    },
    "F11": {
        "label": "Repressive RNA-binding-protein site in the transcript",
        "intendedSource": "CLIP-seq derived binding atlas (MUST VERIFY)",
        "wired": False,
        "blocks": ["A28"],
    },
    "F12": {
        "label": "Pathogenic repeat expansion, with unit and length",
        "intendedSource": "annotation lookup against known repeat-expansion loci",
        "wired": False,
        "blocks": ["A14"],
    },
    "F13": {
        "label": "Polyadenylation site usage",
        "intendedSource": "polyadenylation-site predictor (none exists)",
        "wired": False,
        "blocks": ["A11"],
    },
}


# ---------------------------------------------------------------------------
# Resolution context
# ---------------------------------------------------------------------------

@dataclass
class FeatureContext:
    """Everything the feature layer is allowed to look at.

    Deliberately does NOT carry a therapeutic goal. Goal is an output of
    arbitration, not an input to it.
    """

    gene_symbol: str = ""
    molecular_defect: str | None = None
    known_variant: str | None = None
    variant_hgvs: str | None = None
    transcript_class: str | None = None
    gene_features: dict | None = None
    transcript_sequence: str | None = None
    cds_start: int | None = None
    repeat_unit: str | None = None
    repeat_count: str | None = None
    oligo_length: int = 18
    extras: dict = field(default_factory=dict)

    def gene_feature(self, key: str) -> dict | None:
        feats = (self.gene_features or {}).get("features")
        if isinstance(feats, dict):
            entry = feats.get(key)
            if isinstance(entry, dict):
                return entry
        return None


# ---------------------------------------------------------------------------
# Accessibility (F10a / F10b)
# ---------------------------------------------------------------------------

# RNAplfold parameters. Local folding keeps this linear in transcript length —
# a full partition function over a multi-kb mRNA is not affordable in a
# request path.
PLFOLD_WINDOW = 80
PLFOLD_MAX_BP_SPAN = 40

# A window counts as "designable" when the probability that its whole
# oligo-length stretch is unpaired clears this bar.
#
# NOT CALIBRATED. This threshold is a placeholder chosen to be permissive
# enough to separate structured from unstructured transcripts; it has not
# been fitted against measured ASO activity. It shifts how sharply F10a and
# F10b discriminate, never whether a mechanism is eligible, because both are
# discriminating features rather than gates. Calibrating it is a sign-off
# item (see docs/planning/therapeutic_goal_scope_plan_implementation.md).
ACCESSIBLE_SITE_THRESHOLD = 0.05

# How many distinct designable sites count as "enough". Above this, more
# sites do not make the mechanism more applicable — they make the downstream
# tiling step easier, which is feasibility (plan §3.4) and is reported
# separately rather than folded in here. Also uncalibrated; see the note on
# ACCESSIBLE_SITE_THRESHOLD.
DESIGNABLE_SITE_TARGET = 5

# How far past the start codon the 5'-UTR / start-codon window extends.
# Steric-block translation inhibition (A2) acts on the ribosome scanning and
# initiation region, not the whole transcript.
START_CODON_WINDOW_NT = 30

_VALID_RNA = set("ACGU")


def _clean_rna(seq: str) -> str:
    return "".join(b for b in seq.upper().replace("T", "U") if b in _VALID_RNA)


def _unpaired_profile(seq: str, oligo_length: int) -> list[float] | None:
    """Per-position probability that an oligo-length stretch is unpaired.

    Index i holds the probability for the stretch ENDING at 1-based position
    i+1, matching ViennaRNA's pfl_fold_up layout. Returns None when
    ViennaRNA is unavailable or the transcript is shorter than the oligo.
    """
    if len(seq) < oligo_length:
        return None
    try:
        import RNA  # noqa: PLC0415 — optional heavy dependency
    except ImportError:
        return None

    up = RNA.pfl_fold_up(seq, oligo_length, PLFOLD_WINDOW, PLFOLD_MAX_BP_SPAN)
    # up is 1-indexed with a dummy row 0; each row is indexed by stretch length.
    return [up[i][oligo_length] for i in range(oligo_length, len(seq) + 1)]


def _distinct_sites(profile: list[float], oligo_length: int) -> int:
    """Count NON-OVERLAPPING designable windows.

    Adjacent windows share almost all of their sequence, so counting every
    position that clears the bar counts one accessible region many times over.
    Stepping a full oligo length past each hit counts distinct candidate
    sites, which is what "how many oligos could I actually design here"
    means.
    """
    count = 0
    i = 0
    while i < len(profile):
        if profile[i] >= ACCESSIBLE_SITE_THRESHOLD:
            count += 1
            i += oligo_length
        else:
            i += 1
    return count


def _site_sufficiency(count: int) -> float:
    """Turn a site count into a probability that a design target exists.

    Deliberately NOT a density. A1 needs an accessible cleavable site
    anywhere in the transcript; A2 needs one specifically at the 5' UTR or
    start codon. Those windows differ in length by an order of magnitude, so
    comparing densities would penalise A1 for the transcript being long
    rather than for being inaccessible. A saturating count is comparable
    across window sizes: once there are enough distinct sites to design
    against, more sites do not make the mechanism more applicable.
    """
    return min(1.0, count / DESIGNABLE_SITE_TARGET)


def _resolve_accessibility(ctx: FeatureContext) -> tuple[Feature, Feature]:
    """Resolve F10a and F10b from one fold of the transcript.

    Item 8 of the plan: A1 needs an accessible cleavable site ANYWHERE in the
    transcript; A2 needs one specifically at the 5' UTR / start codon. Those
    are different queries over the same accessibility profile, and running
    both is what separates two mechanisms that otherwise tie on half of all
    inputs.
    """
    why = "No transcript sequence supplied — accessibility not computed."
    if not ctx.transcript_sequence:
        return _unresolved("F10a", why), _unresolved("F10b", why)

    seq = _clean_rna(ctx.transcript_sequence)
    profile = _unpaired_profile(seq, ctx.oligo_length)
    if profile is None:
        why = (
            "Transcript shorter than the oligo, or ViennaRNA unavailable — "
            "accessibility not computed."
        )
        return _unresolved("F10a", why), _unresolved("F10b", why)

    whole_n = _distinct_sites(profile, ctx.oligo_length)
    f10a = Feature(
        id="F10a",
        state=PRESENT if whole_n > 0 else ABSENT,
        probability=_site_sufficiency(whole_n),
        provenance=PREDICTED,
        source=f"ViennaRNA RNAplfold over {len(seq)} nt",
        detail=(
            f"{whole_n} distinct accessible {ctx.oligo_length} nt sites across "
            f"the whole transcript"
        ),
    )

    # The 5'-UTR / start-codon window. Without a CDS start we cannot say where
    # it is, so F10b stays unresolved rather than silently reusing F10a.
    if ctx.cds_start is None:
        f10b = _unresolved(
            "F10b",
            "No CDS start position supplied — the 5' UTR / start-codon window "
            "cannot be located, so the initiation-region query was not run.",
        )
        return f10a, f10b

    end = min(len(profile), max(0, ctx.cds_start + START_CODON_WINDOW_NT))
    window = profile[:end]
    if not window:
        f10b = _unresolved(
            "F10b",
            "The 5' UTR / start-codon window is shorter than one oligo length.",
        )
        return f10a, f10b

    local_n = _distinct_sites(window, ctx.oligo_length)
    f10b = Feature(
        id="F10b",
        state=PRESENT if local_n > 0 else ABSENT,
        probability=_site_sufficiency(local_n),
        provenance=PREDICTED,
        source=f"ViennaRNA RNAplfold over the first {end} nt",
        detail=(
            f"{local_n} distinct accessible {ctx.oligo_length} nt sites in the "
            f"5' UTR and first {START_CODON_WINDOW_NT} nt of CDS"
        ),
    )
    return f10a, f10b


# ---------------------------------------------------------------------------
# Ladder rungs
# ---------------------------------------------------------------------------

def _from_annotation(ctx: FeatureContext, fid: str, key: str,
                     source: str) -> Feature | None:
    """Read an Ensembl-derived structural check from the gene-feature payload.

    Only a *verified* entry counts. The payload reports unverifiable genes as
    available=True so the ranking UI does not silently drop them; treating
    that as a positive finding here would be exactly the guess the plan
    forbids, so an unverified entry falls through to the next rung.
    """
    entry = ctx.gene_feature(key)
    if not entry or not entry.get("verified"):
        return None
    available = bool(entry.get("available"))
    return Feature(
        id=fid,
        state=PRESENT if available else ABSENT,
        # Annotation is a yes/no lookup, not a calibrated probability. ABSENT
        # keeps a small non-zero value so a single annotation miss can never
        # drive a product of features to a hard zero — the state is what
        # gates, the number only ranks.
        probability=0.9 if available else 0.05,
        provenance=ANNOTATION,
        source=source,
        detail=entry.get("reason"),
    )


def _from_defect(ctx: FeatureContext, fid: str, defects: set[str],
                 label: str) -> Feature | None:
    """The user's own molecular-defect selection, echoed back as evidence.

    This is the rung that makes today's top-1 numbers look better than the
    system is: the user asserts the defect, the mechanism is gated on that
    defect, and the same assertion then satisfies the mechanism's required
    feature. It is marked `stand_in` and capped so the output says so.
    """
    if not ctx.molecular_defect:
        return None
    if ctx.molecular_defect not in defects:
        return None
    return Feature(
        id=fid,
        state=PRESENT,
        probability=1.0,
        provenance=USER_ASSERTED,
        source=f"user-selected molecular defect '{ctx.molecular_defect}'",
        stand_in=True,
        detail=(
            f"{label} is taken from your own input, not from "
            f"{FEATURE_CATALOG[fid]['intendedSource']}. Recovery numbers on "
            "this path measure lookup, not arbitration."
        ),
    )


def _from_repeat_text(ctx: FeatureContext) -> Feature | None:
    """F12 from the free-text repeat unit / count fields."""
    unit = _normalize_repeat_unit(ctx.repeat_unit)
    count = _extract_repeat_count(ctx.repeat_count)
    if not unit and count is None:
        return None
    if ctx.repeat_unit and ctx.repeat_unit.strip() and not unit:
        return Feature(
            id="F12",
            state=ABSENT,
            probability=0.02,
            provenance=USER_ASSERTED,
            source="user-supplied repeat unit",
            stand_in=True,
            detail=(
                f"'{ctx.repeat_unit}' is not a valid nucleotide repeat motif."
            ),
        )
    if count is not None and count < PATHOGENIC_REPEAT_THRESHOLD:
        return Feature(
            id="F12",
            state=ABSENT,
            probability=0.05,
            provenance=USER_ASSERTED,
            source="user-supplied repeat count",
            stand_in=True,
            detail=(
                f"~{count} copies is below the pathogenic expansion threshold "
                f"(~{PATHOGENIC_REPEAT_THRESHOLD})."
            ),
        )
    known = KNOWN_REPEAT_UNITS.get(unit or "")
    return Feature(
        id="F12",
        state=PRESENT,
        probability=0.9 if known else 0.7,
        provenance=USER_ASSERTED,
        source="user-supplied repeat unit / count",
        stand_in=True,
        detail=(
            f"Repeat unit {unit} recognised ({known})"
            if known
            else f"Repeat unit {unit} accepted as a nucleotide repeat motif "
                 "(not in the curated reference list)"
        ),
    )


def _from_variant_text(ctx: FeatureContext) -> Feature | None:
    """F9 from a user-supplied variant description."""
    text = (ctx.variant_hgvs or ctx.known_variant or "").strip()
    if not text:
        return None
    return Feature(
        id="F9",
        state=PRESENT,
        probability=0.8,
        provenance=USER_ASSERTED,
        source="user-supplied variant description",
        stand_in=True,
        detail=(
            f"'{text}' taken as an allele-distinguishing variant. Not checked "
            "against dbSNP or ClinVar — no variant database is wired."
        ),
    )


# Repeat-expansion reference data, moved here from mechanism_service because
# it is feature evidence (F12), not ranking logic.
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

PATHOGENIC_REPEAT_THRESHOLD = 30


def _extract_repeat_count(repeat_text: str | None) -> int | None:
    """Pull the largest number out of free text like '>50 copies' or '55–200'."""
    if not repeat_text or not repeat_text.strip():
        return None
    numbers = [int(n.replace(",", "")) for n in re.findall(r"\d[\d,]*", repeat_text)]
    return max(numbers) if numbers else None


def _normalize_repeat_unit(repeat_unit: str | None) -> str | None:
    """Strip punctuation / non-nucleotide characters and uppercase the unit."""
    if not repeat_unit:
        return None
    cleaned = re.sub(r"[^ACGTUacgtu]", "", repeat_unit).upper()
    return cleaned or None


# ---------------------------------------------------------------------------
# The ladders
# ---------------------------------------------------------------------------

# Each entry is an ordered list of callables. The first to return a Feature
# wins. An empty list means the feature has no source at all and always
# resolves UNRESOLVED — the mechanisms requiring it halt.
_LADDERS: dict[str, list[Callable[[FeatureContext], Feature | None]]] = {
    "F1": [lambda c: _from_defect(
        c, "F1", {"exon_skipping_mutation", "exon_inclusion_defect"},
        "Weak exon recognition")],
    "F2": [lambda c: _from_defect(
        c, "F2", {"cryptic_splice_site"}, "Cryptic splice-site creation")],
    "F3": [lambda c: _from_defect(
        c, "F3", {"pseudoexon_activation"}, "Pseudoexon activation")],
    "F4": [
        lambda c: _from_annotation(
            c, "F4", "TANGO", "Ensembl transcript biotypes / splicing complexity"),
        lambda c: _from_defect(
            c, "F4", {"poison_exon_inclusion"}, "Poison-exon presence"),
    ],
    "F5": [
        lambda c: _from_annotation(
            c, "F5", "uORF", "Ensembl 5' UTR open-reading-frame scan"),
        lambda c: _from_defect(
            c, "F5", {"uorf_mediated_repression"}, "Repressive uORF presence"),
    ],
    "F6": [
        lambda c: _from_annotation(
            c, "F6", "NAT", "Ensembl overlapping-transcript lookup"),
        lambda c: _from_defect(
            c, "F6", {"nat_mediated_repression"},
            "Overlapping antisense transcript"),
    ],
    "F7": [lambda c: _from_defect(
        c, "F7", {"mirna_mediated_repression"}, "Repressive miRNA site")],
    "F8": [lambda c: _from_defect(
        c, "F8", {"epigenetic_promoter_silencing"}, "Promoter silencing")],
    "F9": [_from_variant_text],
    # F10a / F10b are resolved together from a single fold; see
    # _resolve_accessibility. They are listed here for completeness only.
    "F10a": [],
    "F10b": [],
    # Deliberately empty — plan §6.2 and §6.4.
    "F11": [],
    "F13": [],
    "F12": [_from_repeat_text],
}

_NO_SOURCE_REASON = {
    "F11": (
        "No repressive-RBP-site source is wired. Candidate sources are "
        "CLIP-seq derived binding atlases; none has been verified, so this "
        "feature cannot be established and A28 halts rather than guessing."
    ),
    "F13": (
        "No polyadenylation-site predictor is wired, so which poly(A) site is "
        "used cannot be established and A11 halts rather than guessing."
    ),
}


def resolve_features(ctx: FeatureContext) -> dict[str, Feature]:
    """Resolve the whole vocabulary for one target transcript."""
    out: dict[str, Feature] = {}

    f10a, f10b = _resolve_accessibility(ctx)
    out["F10a"] = f10a
    out["F10b"] = f10b

    for fid, ladder in _LADDERS.items():
        if fid in out:
            continue
        resolved: Feature | None = None
        for rung in ladder:
            resolved = rung(ctx)
            if resolved is not None:
                break
        if resolved is None:
            reason = _NO_SOURCE_REASON.get(fid)
            if reason is None:
                intended = FEATURE_CATALOG[fid]["intendedSource"]
                reason = (
                    f"Not established for this transcript. Intended source "
                    f"({intended}) is not wired, and no user input stands in "
                    f"for it here."
                )
            resolved = _unresolved(fid, reason)
        out[fid] = resolved

    return out


def unwired_features() -> list[str]:
    """Feature IDs whose intended source is not installed. For reporting."""
    return sorted(f for f, spec in FEATURE_CATALOG.items() if not spec["wired"])
