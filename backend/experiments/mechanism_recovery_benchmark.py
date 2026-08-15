"""Retrospective mechanism-recovery benchmark for the mechanism ranking layer.

QUESTION
--------
Given only what a clinician/scientist knew *before* a drug was developed --
the gene, the molecular defect, and the delivery route -- does
`mechanism_service` rank the mechanism that was actually developed first?

This is the only evaluation the mechanism layer currently has. It is small
(n=11) but it is real: every row is an FDA-approved antisense oligonucleotide
whose mechanism is a matter of public record.

GROUND TRUTH SOURCE
-------------------
Sang A, Zhuo S, Bochanis A, Manautou JE, Bahal R, Zhong X-B, Rasmussen TP.
"Mechanisms of Action of the US Food and Drug Administration-Approved
Antisense Oligonucleotide Drugs." BioDrugs. 2024;38(4):511-526.
PMID 38914784. DOI 10.1007/s40259-024-00665-2.  Table 1 + Sections 5.1-5.4.

Every drug/gene/mechanism assignment below is transcribed from that table.
Nothing is recalled from memory.

SCOPE
-----
Both single-stranded ASOs and siRNA drugs are included.

siRNA used to be excluded: every siRNA drug maps to A21, which the platform
marked NON-DESIGNABLE and dropped from the ranking, so those drugs could not
be scored. A21 is now SCORED and competes — siRNA is a genuine alternative to
RNase H knockdown for any knockdown target, and with five approved drugs it is
fully validatable — so excluding the drugs that validate it would leave the
benchmark measuring a mechanism set the platform no longer uses.

Adding them changes the headline: A21 carries a Very High evidence rating
against A1's High, so it outranks A1 on every knockdown case. Read
`design_available` alongside `strict`. The gap between them is the honest
statement of the problem: on gene, defect and delivery alone this platform
cannot tell a gapmer target from an siRNA target, because nothing in those
inputs distinguishes them. TTR is the clearest case — inotersen (A1) and
patisiran (A21) are both approved, for the same gene, defect and route.

The `defect` and `scope` fields are the INPUTS a user would supply. Where the
mapping from the published disease biology onto the platform's fixed
vocabulary is a judgement call, `input_note` records it. Those rows are
reported separately -- a benchmark that quietly resolves its own ambiguities
is measuring the person who built it.

Run:  python -m backend.experiments.mechanism_recovery_benchmark
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.services import mechanism_arbitration as A  # noqa: E402
from backend.services import mechanism_service as M  # noqa: E402

SOURCE = "Sang et al. BioDrugs 2024;38(4):511-526. PMID 38914784, Table 1."

# ---------------------------------------------------------------------------
# TG01 -- gene silencing (RNase H MOA in the source table)
# ---------------------------------------------------------------------------
TG01_CASES = [
    dict(drug="Inotersen", gene="TTR", disease="hATTR",
         defect="gain_of_function", scope="total_knockdown",
         delivery="liver", truth="A1", input_note=None),
    dict(drug="Eplontersen", gene="TTR", disease="hATTR",
         defect="gain_of_function", scope="total_knockdown",
         delivery="liver", truth="A1", input_note=None),
    dict(drug="Fomivirsen", gene="HCMV IE2", disease="CMV retinitis",
         defect="viral_toxic_rna", scope="total_knockdown",
         delivery=None, truth="A1", input_note=None),
    dict(drug="Tofersen", gene="SOD1", disease="SOD1-ALS",
         defect="gain_of_function", scope="total_knockdown",
         delivery="cns", truth="A1", input_note=None,
         alt_input=dict(scope="allele_specific"),
         alt_note="INPUT SENSITIVITY. The biology reads as gain-of-function, "
                  "which invites a user to enter allele_specific; but "
                  "tofersen is not allele-selective and lowers WT and mutant "
                  "alike. Both inputs are run and reported (S6.4c)."),
    dict(drug="Mipomersen", gene="APOB", disease="HoFH",
         defect="therapeutic_reduction", scope="total_knockdown",
         delivery="liver", truth="A1", input_note=None),
]

# ---------------------------------------------------------------------------
# TG01 -- RNAi (A21). Added when A21 became a scored, competing mechanism.
#
# PROVENANCE, DIFFERENT FROM THE ROWS ABOVE. The five drug names come from
# A21's own rulebook `fdaApprovedDrugs` field. The gene and indication for
# each is the drug's well-known approved target. Sang et al. is an
# antisense-oligonucleotide review; it is NOT being cited as the table these
# five rows were transcribed from.
#
# MUST VERIFY before publishing: pin each row to a specific source line
# (FDA label or a review that tabulates siRNA drugs) the way the ASO rows are
# pinned to Sang et al. Table 1.
#
# Every row carries an input_note, so all five land in the `contested` bucket
# and none of them moves the unambiguous headline. The defect classification
# is the reason: four of the five knock down a NORMAL gene whose reduction is
# therapeutic rather than a mutant one, which is a judgement call on this
# platform's defect vocabulary, not a fact from a table.
# ---------------------------------------------------------------------------
SIRNA_CASES = [
    dict(drug="Patisiran", gene="TTR", disease="hATTR polyneuropathy",
         defect="gain_of_function", scope="total_knockdown",
         delivery="liver", truth="A21",
         input_note="COLLIDES WITH INOTERSEN. Same gene, same defect, same "
                    "delivery route as an approved gapmer (A1). Both drugs "
                    "exist; the inputs cannot separate them. This row and the "
                    "inotersen row cannot both be top-1 correct."),
    dict(drug="Vutrisiran", gene="TTR", disease="hATTR polyneuropathy",
         defect="gain_of_function", scope="total_knockdown",
         delivery="liver", truth="A21",
         input_note="Collides with inotersen/eplontersen as above."),
    dict(drug="Givosiran", gene="ALAS1", disease="Acute hepatic porphyria",
         defect="therapeutic_reduction", scope="total_knockdown",
         delivery="liver", truth="A21",
         input_note="DEFECT CLASSIFICATION IS A JUDGEMENT CALL. ALAS1 is not "
                    "the mutated gene in AHP (HMBS is); ALAS1 is induced and "
                    "lowering it reduces toxic intermediates. Entered as "
                    "therapeutic_reduction; 'overexpression' is defensible."),
    dict(drug="Lumasiran", gene="HAO1", disease="Primary hyperoxaluria type 1",
         defect="therapeutic_reduction", scope="total_knockdown",
         delivery="liver", truth="A21",
         input_note="Substrate reduction therapy against a normal gene; the "
                    "mutated gene is AGXT. Same classification call as "
                    "givosiran."),
    dict(drug="Inclisiran", gene="PCSK9", disease="Hypercholesterolaemia",
         defect="therapeutic_reduction", scope="total_knockdown",
         delivery="liver", truth="A21",
         input_note="Normal protein whose reduction is therapeutic. Same "
                    "class as mipomersen (A1), which is the same defect entry "
                    "with a different mechanism outcome."),
]


# ---------------------------------------------------------------------------
# TG04 -- RNA processing modulation (splice-modulating MOA in the source table)
# ---------------------------------------------------------------------------
TG04_CASES = [
    dict(drug="Eteplirsen", gene="DMD", disease="DMD (exon 51 skip)",
         defect="exon_skipping_mutation", exon="51",
         delivery="local_intramuscular", truth="A7", input_note=None),
    dict(drug="Golodirsen", gene="DMD", disease="DMD (exon 53 skip)",
         defect="exon_skipping_mutation", exon="53",
         delivery=None, truth="A7", input_note=None),
    dict(drug="Viltolarsen", gene="DMD", disease="DMD (exon 53 skip)",
         defect="exon_skipping_mutation", exon="53",
         delivery=None, truth="A7", input_note=None),
    dict(drug="Casimersen", gene="DMD", disease="DMD (exon 45 skip)",
         defect="exon_skipping_mutation", exon="45",
         delivery=None, truth="A7", input_note=None),
    dict(drug="Nusinersen", gene="SMN2", disease="SMA",
         defect="exon_inclusion_defect", exon="7",
         delivery="cns", truth="A8",
         input_note="GOAL-ROUTING AMBIGUITY. The therapeutic intent is to "
                    "RAISE SMN protein (TG02, upregulation); the mechanism is "
                    "splice modulation (TG04). A user who picks TG02 never "
                    "sees A8 at all."),
    dict(drug="Milasen", gene="MFSD8 (CLN7)", disease="Batten disease, n-of-1",
         defect="cryptic_splice_site", exon="6",
         delivery="cns", truth="A10", truth_family={"A9", "A10"},
         input_note="CONTESTED TRUTH. A SINE-VNTR-Alu insertion creates a "
                    "cryptic splice acceptor. The source calls it a cryptic "
                    "splice-acceptor site (-> A10); calling the inserted "
                    "element a pseudoexon (-> A9) is equally defensible. "
                    "Scored at all three resolutions (S6.4b); not resolved "
                    "here."),
]


def _rank_ids(results: list[dict]) -> list[str]:
    return [r["id"] for r in results]


def _eligible_scores(results: list[dict]) -> dict[str, float]:
    """Applicability of the mechanisms that actually survived the gates.

    Mechanisms rejected at a gate are excluded rather than carried at a low
    score: a gate failure is a rejection, not a weak candidate (plan §3.2),
    and including them would let a rejected mechanism inflate or deflate the
    tie count for the ones still in the running.
    """
    return {
        r["id"]: r["applicability"]["upper"]
        for r in results
        if r["status"] == "ELIGIBLE"
    }


GOAL_MECHANISMS = {
    "TG01": {"A1", "A2", "A12", "A15", "A21"},
    "TG04": {"A7", "A8", "A9", "A10", "A11"},
}


def _evaluate(ranked_ids: list[str], scores: dict, truth: str,
              goal: str, truth_family: set[str] | None = None) -> dict:
    """Score at three resolutions (plan S6.4b).

    exact   -- the one mechanism the source names
    family  -- any mechanism in truth_family (defaults to {truth}); used
               where two readings of the same biology yield near-identical
               designs, so the clinical decision is unchanged
    goal    -- any mechanism belonging to the correct therapeutic goal;
               separates goal ROUTING failures from mechanism CHOICE failures

    Top-1 is credited outright only on a strict win. A tie at the top is not
    a correct top-1: the score did not distinguish the right answer, the
    downstream sort key did.
    """
    family = truth_family or {truth}
    goal_set = GOAL_MECHANISMS.get(goal, set())
    if truth not in ranked_ids:
        # The truth mechanism is not in the ranking at all (it was filtered
        # out, e.g. A21 under the design-available reading). Nothing about it
        # can be scored — but whether the top answer landed in the right
        # therapeutic goal is still a fact worth keeping, since that is the
        # metric that separates goal ROUTING from mechanism CHOICE.
        return dict(top1_exact=False, top1_family=False,
                    top1_goal=bool(ranked_ids) and ranked_ids[0] in goal_set,
                    top3_exact=False, rank=None, tied_at_top=0,
                    outright=False)
    rank = ranked_ids.index(truth) + 1
    top_score = max(scores.values()) if scores else None
    tied = sum(1 for v in scores.values() if v == top_score)
    first = ranked_ids[0]
    return dict(top1_exact=(first == truth),
                top1_family=(first in family),
                top1_goal=(first in goal_set),
                top3_exact=(rank <= 3),
                rank=rank, tied_at_top=tied,
                outright=(rank == 1 and tied == 1))


# ---------------------------------------------------------------------------
# Goal-agnostic scoring (plan item 10)
#
# The per-goal runs above tell the user's goal to the scorer before it ranks
# anything. That is the setting in which nusinersen's correct answer is
# invisible to a user who (correctly) thinks of SMA as an upregulation
# problem. The runs below never mention a goal.
#
# Two conditions, because they answer different questions:
#
#   defect_only   the molecular defect is supplied, the goal is not.
#                 Question: does removing goal routing break anything, and
#                 does the right answer surface without being told where to
#                 look?
#
#   gene_only     nothing but the gene is supplied. Question: what can the
#                 system do with no user assertion at all? This is the
#                 condition SpliceAI is meant to serve, and until it is
#                 wired the answer is expected to be "nothing" — reported
#                 rather than omitted, because it is the number that says
#                 how much of the per-goal performance is the user's input
#                 rather than the system's.
# ---------------------------------------------------------------------------

ALL_CASES = [dict(c, goal="TG01") for c in TG01_CASES + SIRNA_CASES] + \
            [dict(c, goal="TG04") for c in TG04_CASES]


def _goal_agnostic_row(case: dict, supply_defect: bool) -> dict:
    ctx = A.ArbitrationContext(
        gene_symbol=case["gene"],
        molecular_defect=case["defect"] if supply_defect else None,
        allele_selective=(case.get("scope") == "allele_specific")
        if supply_defect else None,
        delivery_context=case["delivery"],
    )
    out = A.arbitrate(ctx)
    res = out["results"]
    ids = _rank_ids(res)
    scores = _eligible_scores(res)
    ev = _evaluate(ids, scores, case["truth"], case["goal"],
                   case.get("truth_family"))
    eligible = [r for r in res if r["status"] == "ELIGIBLE"]
    truth_row = next((r for r in res if r["id"] == case["truth"]), None)
    return dict(
        drug=case["drug"], gene=case["gene"], truth=case["truth"],
        goal=case["goal"], ranked=ids[:5], n_eligible=len(eligible),
        reported_goal=out["therapeuticGoal"],
        goal_label_correct=(out["therapeuticGoal"] == case["goal"]),
        truth_status=truth_row["status"] if truth_row else None,
        # Did the winning answer rest entirely on the user's own form input?
        stand_in_only=bool(eligible and eligible[0]["standInOnly"]),
        **ev,
    )


def run_goal_agnostic() -> dict:
    def agg(rs):
        n = len(rs)
        return dict(
            n=n,
            top1_exact=round(sum(r["top1_exact"] for r in rs) / n, 3),
            outright_top1=round(sum(r["outright"] for r in rs) / n, 3),
            top3_exact=round(sum(r["top3_exact"] for r in rs) / n, 3),
            goal_label_correct=round(
                sum(r["goal_label_correct"] for r in rs) / n, 3),
            mean_eligible=round(sum(r["n_eligible"] for r in rs) / n, 2),
            stand_in_only=round(sum(r["stand_in_only"] for r in rs) / n, 3),
        )

    defect_only = [_goal_agnostic_row(c, True) for c in ALL_CASES]
    gene_only = [_goal_agnostic_row(c, False) for c in ALL_CASES]
    return dict(
        defect_only=dict(rows=defect_only, agg=agg(defect_only)),
        gene_only=dict(rows=gene_only, agg=agg(gene_only)),
    )


def run() -> dict:
    rows = []

    for c in TG01_CASES + SIRNA_CASES:
        res = M.rank_gene_silencing_mechanisms(
            c["defect"], c["scope"], c["delivery"], None)
        ids = _rank_ids(res)
        scores = _eligible_scores(res)
        row = {**c, "goal": "TG01", "ranked": ids, "scores": scores,
               **_evaluate(ids, scores, c["truth"], "TG01",
                           c.get("truth_family"))}
        # Second reading: restricted to mechanisms this pipeline can actually
        # emit a design for. A21 is scored and competes, but a user of THIS
        # designer cannot act on it, so both numbers are meaningful and they
        # answer different questions.
        buildable = [r for r in res if r.get("designAvailable", True)]
        row["design_available"] = _evaluate(
            _rank_ids(buildable), _eligible_scores(buildable), c["truth"],
            "TG01", c.get("truth_family"))
        rows.append(row)

    for c in TG04_CASES:
        res = M.rank_rna_processing_mechanisms(
            c["defect"], c.get("exon"), c["delivery"], None)
        ids = _rank_ids(res)
        scores = _eligible_scores(res)
        row = {**c, "goal": "TG04", "ranked": ids, "scores": scores,
               **_evaluate(ids, scores, c["truth"], "TG04",
                           c.get("truth_family"))}
        # No TG04 mechanism is design-unavailable, so this reading is
        # identical to the unrestricted one. Computed anyway so the aggregate
        # covers every row.
        row["design_available"] = {
            k: row[k] for k in
            ("top1_exact", "top1_family", "top1_goal", "top3_exact",
             "rank", "tied_at_top", "outright")
        }
        rows.append(row)

    # Input-sensitivity runs (S6.4c). Not scored into the headline -- these
    # report whether a defensible ALTERNATIVE user input changes the answer.
    sensitivity = []
    for c in TG01_CASES:
        alt = c.get("alt_input")
        if not alt:
            continue
        res = M.rank_gene_silencing_mechanisms(
            alt.get("defect", c["defect"]), alt.get("scope", c["scope"]),
            c["delivery"], None)
        alt_ids = _rank_ids(res)
        base = next(r["ranked"] for r in rows if r["drug"] == c["drug"])
        sensitivity.append(dict(drug=c["drug"], note=c.get("alt_note"),
                                alt_input=alt, base_ranking=base,
                                alt_ranking=alt_ids,
                                answer_changed=(base[0] != alt_ids[0])))

    goal_agnostic = run_goal_agnostic()

    contested = [r for r in rows if r["input_note"]]
    clean = [r for r in rows if not r["input_note"]]

    def agg(rs):
        if not rs:
            return {}
        n = len(rs)
        return dict(n=n,
                    top1_exact=round(sum(r["top1_exact"] for r in rs) / n, 3),
                    top1_family=round(sum(r["top1_family"] for r in rs) / n, 3),
                    top1_goal=round(sum(r["top1_goal"] for r in rs) / n, 3),
                    outright_top1=round(sum(r["outright"] for r in rs) / n, 3),
                    top3_exact=round(sum(r["top3_exact"] for r in rs) / n, 3))

    # Honest unique-case count (S6.2a): the four DMD drugs are one biological
    # case, inotersen/eplontersen are one. Report both.
    unique_cases = {(r["gene"], r["truth"]) for r in rows}

    return dict(source=SOURCE, rows=rows, sensitivity=sensitivity,
                n_drugs=len(rows), n_unique_gene_mechanism=len(unique_cases),
                strict=agg(rows), unambiguous_only=agg(clean),
                contested=agg(contested),
                design_available=agg([r["design_available"] for r in rows]),
                goal_agnostic=goal_agnostic)


def main() -> None:
    out = run()

    print("=" * 78)
    print("MECHANISM-RECOVERY BENCHMARK")
    print("ground truth:", out["source"])
    print(f"{out['n_drugs']} approved drugs = "
          f"{out['n_unique_gene_mechanism']} unique gene/mechanism cases")
    print("=" * 78)

    print(f"{'drug':<13}{'gene':<14}{'goal':<7}{'truth':<7}{'rank':<6}"
          f"{'tied':<6}{'ranking'}")
    print("-" * 78)
    for r in out["rows"]:
        mark = "!" if r["input_note"] else " "
        print(f"{r['drug']:<13}{r['gene']:<14}{r['goal']:<7}{r['truth']:<7}"
              f"{str(r['rank']):<6}{r['tied_at_top']:<6}"
              f"{'>'.join(r['ranked'])}{mark}")

    print()
    for k in ("strict", "unambiguous_only", "contested", "design_available"):
        if out[k]:
            print(f"{k:<18}", json.dumps(out[k]))
    print()
    print("design_available -- same cases, ranking restricted to mechanisms")
    print("    this pipeline can emit a design for. The gap against `strict`")
    print("    is A21: it is scored and competes on merit (Very High evidence,")
    print("    five approved drugs), but a user of this single-stranded")
    print("    designer cannot act on it. Neither number alone is the answer.")
    print()
    print("    The two top1_exact figures being equal is a coincidence, not a")
    print("    bug: they are right about DIFFERENT rows. `strict` recovers the")
    print("    five siRNA drugs and misses the five gapmers; restricting to")
    print("    design-available recovers the five gapmers and loses A21")
    print("    entirely. Both get the six splice-modulating rows.")
    print()
    print("    WHAT THIS EXPOSES. On gene, defect and delivery alone the")
    print("    platform cannot separate a gapmer target from an siRNA target,")
    print("    because nothing in those inputs distinguishes them. TTR carries")
    print("    an approved drug of each kind at identical inputs, so no")
    print("    ranking over this input set can be right about both.")

    ga = out["goal_agnostic"]
    print()
    print("=" * 78)
    print("GOAL-AGNOSTIC SCORING — every designable mechanism, no goal given")
    print("=" * 78)
    for cond, blurb in (
        ("defect_only", "molecular defect supplied, therapeutic goal NOT"),
        ("gene_only", "gene only — no defect, no goal"),
    ):
        print(f"\n{cond}  ({blurb})")
        print(f"  {json.dumps(ga[cond]['agg'])}")
        print(f"  {'drug':<13}{'truth':<7}{'status':<10}{'rank':<6}"
              f"{'tied':<6}{'elig':<6}{'goal?':<7}ranking")
        for r in ga[cond]["rows"]:
            print(f"  {r['drug']:<13}{r['truth']:<7}"
                  f"{str(r['truth_status']):<10}{str(r['rank']):<6}"
                  f"{r['tied_at_top']:<6}{r['n_eligible']:<6}"
                  f"{('yes' if r['goal_label_correct'] else 'NO'):<7}"
                  f"{'>'.join(r['ranked'])}")

    print()
    print("READ THIS BEFORE QUOTING THE defect_only NUMBERS.")
    print("stand_in_only reports the fraction of winning answers whose every")
    print("supporting feature is the user's own form input echoed back. Where")
    print("it is 1.0, the defect dropdown already contains the answer and the")
    print("ranking is a lookup, not an arbitration. Wiring SpliceAI (F1-F3,")
    print("checklist item 5) is what turns those rows into a real test.")
    print()
    print("The gene_only condition is the honest ceiling: with no defect")
    print("supplied nothing gates, every mechanism stays eligible, and the")
    print("ordering is whatever the rulebook evidence ratings and the")
    print("deterministic id tie-break produce. A high top-1 there measures")
    print("alphabetical luck, which is why tied and elig are printed beside it.")

    if out["sensitivity"]:
        print()
        print("INPUT SENSITIVITY (not scored into the headline)")
        for s_ in out["sensitivity"]:
            flag = "CHANGED" if s_["answer_changed"] else "stable"
            print(f"  {s_['drug']:<13}{str(s_['alt_input']):<34}{flag}")
            print(f"    base {'>'.join(s_['base_ranking'])}")
            print(f"    alt  {'>'.join(s_['alt_ranking'])}")

    print()
    print("! = contested ground truth; scored at all three resolutions and")
    print("    reported separately, not adjudicated here.")
    print()
    print("top1_exact  -- the one mechanism the source names")
    print("top1_family -- either reading of a contested case counts")
    print("top1_goal   -- any mechanism in the right therapeutic goal;")
    print("               separates goal ROUTING from mechanism CHOICE")
    print("outright    -- truth strictly outscored every alternative; where")
    print("               it merely tied, the sort key decided, not the score")

    p = Path(__file__).resolve().parents[1] / "results" / "mechanism_recovery.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, indent=2, default=list))
    print(f"\nwrote {p}")


if __name__ == "__main__":
    main()
