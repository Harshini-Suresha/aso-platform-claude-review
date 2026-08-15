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
Only single-stranded ASOs are included. siRNA drugs (patisiran, givosiran,
inclisiran, ...) all map to A21, which this platform marks NON-DESIGNABLE and
drops from the ranking, so they cannot be scored here.

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
        return dict(top1_exact=False, top1_family=False, top1_goal=False,
                    top3_exact=False, rank=None, tied_at_top=0,
                    outright=False)
    rank = ranked_ids.index(truth) + 1
    top_score = max(scores.values())
    tied = sum(1 for v in scores.values() if v == top_score)
    first = ranked_ids[0]
    return dict(top1_exact=(first == truth),
                top1_family=(first in family),
                top1_goal=(first in goal_set),
                top3_exact=(rank <= 3),
                rank=rank, tied_at_top=tied,
                outright=(rank == 1 and tied == 1))


def run() -> dict:
    rows = []

    for c in TG01_CASES:
        res = M.rank_gene_silencing_mechanisms(
            c["defect"], c["scope"], c["delivery"], None)
        ids = _rank_ids(res)
        scores = {r["id"]: r["score"] for r in res}
        rows.append({**c, "goal": "TG01", "ranked": ids, "scores": scores,
                     **_evaluate(ids, scores, c["truth"], "TG01",
                                 c.get("truth_family"))})

    for c in TG04_CASES:
        res = M.rank_rna_processing_mechanisms(
            c["defect"], c.get("exon"), c["delivery"], None)
        ids = _rank_ids(res)
        scores = {r["id"]: r["score"] for r in res}
        rows.append({**c, "goal": "TG04", "ranked": ids, "scores": scores,
                     **_evaluate(ids, scores, c["truth"], "TG04",
                                 c.get("truth_family"))})

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
                contested=agg(contested))


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
    for k in ("strict", "unambiguous_only", "contested"):
        if out[k]:
            print(f"{k:<18}", json.dumps(out[k]))

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
