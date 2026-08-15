"""Recover real target-gene annotations for the siRNA rows.

WHY THIS EXISTS
---------------
`data_curation/unified.py` used to rename siRBench's `mRNA` column to
`target_gene`. That column holds the ~19 nt TARGET SITE SEQUENCE, not a gene
symbol, so the unified benchmark ended up with one distinct "gene" per row
(3,947 genes / 3,947 rows) and every `--split gene` run silently became a
random row split for that modality while still reporting `"split": "gene"`.

siRBench carries no gene identifier in any column -- I checked all 106 -- so
the annotation cannot be reconstructed from the repo. It has to be recovered
by sequence search against a transcript database, which needs network access
the analysis sandbox does not have.

Until this has been run, `target_gene` is NA for siRNA rows and grouped
splits refuse to run (see `invariant_ranker.split_experiments`). That refusal
is deliberate: a mislabelled protocol is worse than a missing one.

WHAT IT DOES
------------
Takes the `extended_mRNA` column (~57 nt window around the target site, much
more specific than the 19 nt site alone), searches it against a human
transcript database, and writes back a gene symbol plus the evidence for it.

INPUT
-----
`backend/data/raw/siRBench/siRBench_{train,test,leftout}.csv`
Columns used: `siRNA`, `mRNA`, `extended_mRNA`, `source`, `cell_line`.

OUTPUT
------
`sirna_gene_annotation.csv` with columns:
    seq, extended_mRNA, target_gene, accession, pct_identity,
    alignment_length, evalue, annotation_method, annotation_date

Then re-run `data_curation/unified.py` with `--sirna_annotation` pointing at
that file.

BACKENDS
--------
Two are supported. Pick with `--backend`.

  ncbi_blast   Remote NCBI BLAST against `refseq_rna`, human only
               (taxid 9606). No local database needed, but rate-limited and
               slow -- expect hours for ~4,000 sequences. Be polite: NCBI
               asks for <=3 requests/second and an identifying email.

  local_blast  blastn against a locally built database from a RefSeq or
               GENCODE transcript FASTA. Much faster. Requires NCBI BLAST+
               installed and a downloaded transcript FASTA.

ACCEPTANCE CRITERIA -- read before trusting the output
------------------------------------------------------
A hit is accepted only when ALL of these hold:

  * percent identity >= MIN_IDENTITY (default 98)
  * alignment length >= MIN_ALIGN_LEN (default 50 of the ~57 nt window)
  * the best hit's bitscore exceeds the second-best DIFFERENT gene's by
    MIN_BITSCORE_MARGIN (default 10) -- a sequence matching two genes almost
    equally well is not annotated, it is left NA

Anything failing these is written with `target_gene` empty and
`annotation_method` = "AMBIGUOUS" or "NO_HIT". Do not backfill those with a
guess. An unannotated row correctly excluded from a gene split is far better
than a wrongly annotated one silently included.

Expect a meaningful fraction to fail. The Hueskenset targets a limited number
of genes; Reynolds, Ui-Tei and the others differ. Report the annotation rate
per source dataset alongside any result that uses this file.

USAGE
-----
    python -m backend.data_curation.annotate_sirna_genes \\
        --sirbench backend/data/raw/siRBench \\
        --backend local_blast \\
        --db /path/to/refseq_human_rna \\
        --output backend/data/raw/siRBench/sirna_gene_annotation.csv

    python -m backend.data_curation.annotate_sirna_genes \\
        --sirbench backend/data/raw/siRBench \\
        --backend ncbi_blast \\
        --email you@institution.edu \\
        --output backend/data/raw/siRBench/sirna_gene_annotation.csv
"""

from __future__ import annotations

import argparse
import csv
import datetime as _dt
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

import pandas as pd

MIN_IDENTITY = 98.0
MIN_ALIGN_LEN = 50
MIN_BITSCORE_MARGIN = 10.0

OUTFIELDS = [
    "seq", "extended_mRNA", "target_gene", "accession", "pct_identity",
    "alignment_length", "evalue", "annotation_method", "annotation_date",
]


def load_queries(sirbench_dir: Path) -> pd.DataFrame:
    parts = []
    for name in ("siRBench_train.csv", "siRBench_test.csv",
                 "siRBench_leftout.csv"):
        p = sirbench_dir / name
        if p.exists():
            parts.append(pd.read_csv(p))
    if not parts:
        sys.exit(f"no siRBench_*.csv found in {sirbench_dir}")
    d = pd.concat(parts, ignore_index=True)
    d = d[["siRNA", "mRNA", "extended_mRNA", "source"]].copy()
    d["seq"] = d["siRNA"].str.upper().str.replace("T", "U", regex=False)
    # Query on the longer window: 19 nt is short enough to hit many
    # transcripts by chance, ~57 nt is not.
    d = d.drop_duplicates(subset=["extended_mRNA"])
    return d


def write_fasta(df: pd.DataFrame, path: Path) -> None:
    with path.open("w") as fh:
        for i, row in df.iterrows():
            fh.write(f">q{i}\n{row['extended_mRNA']}\n")


def run_local_blast(fasta: Path, db: str, threads: int) -> list[dict]:
    """blastn against a local transcript database."""
    cmd = [
        "blastn", "-query", str(fasta), "-db", db,
        "-outfmt", "6 qseqid sseqid pident length evalue bitscore stitle",
        "-max_target_seqs", "20", "-num_threads", str(threads),
        "-task", "megablast",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.exit(f"blastn failed:\n{proc.stderr}")
    hits = []
    for line in proc.stdout.splitlines():
        f = line.split("\t")
        hits.append(dict(qid=f[0], sid=f[1], pident=float(f[2]),
                         length=int(f[3]), evalue=float(f[4]),
                         bitscore=float(f[5]),
                         title=f[6] if len(f) > 6 else ""))
    return hits


def run_ncbi_blast(fasta: Path, email: str) -> list[dict]:
    """Remote NCBI BLAST. Deliberately not implemented inline.

    Submitting several thousand queries to NCBI's public service needs
    batching, polling, backoff and an identifying email, and getting that
    wrong gets an institution rate-limited. Use Biopython's NCBIWWW with
    `database='refseq_rna'` and `entrez_query='txid9606[ORGN]'`, batch ~50
    sequences per submission, and poll rather than busy-wait.

    The local_blast path is strongly preferred and roughly two orders of
    magnitude faster.
    """
    raise NotImplementedError(
        "Remote NCBI BLAST path is not implemented -- see the docstring. "
        "Use --backend local_blast, or implement batched submission with "
        "Biopython NCBIWWW and re-run."
    )


def gene_from_title(title: str) -> str | None:
    """Extract a gene symbol from a RefSeq/GENCODE FASTA defline.

    Deliberately conservative: returns None rather than guessing. RefSeq
    deflines carry '(SYMBOL),' and GENCODE deflines are pipe-delimited with
    the symbol in field 5. Anything else is not parsed.
    """
    if "|" in title:                      # GENCODE style
        parts = title.split("|")
        if len(parts) >= 6:
            return parts[5]
        return None
    if "(" in title and ")" in title:     # RefSeq style
        inner = title[title.rindex("(") + 1: title.rindex(")")]
        if inner and " " not in inner and len(inner) <= 20:
            return inner
    return None


def resolve(hits: list[dict], df: pd.DataFrame) -> list[dict]:
    """Apply the acceptance criteria. Ambiguity is recorded, never resolved."""
    by_q: dict[str, list[dict]] = defaultdict(list)
    for h in hits:
        if h["pident"] >= MIN_IDENTITY and h["length"] >= MIN_ALIGN_LEN:
            by_q[h["qid"]].append(h)

    today = _dt.date.today().isoformat()
    rows = []
    for i, r in df.iterrows():
        qid = f"q{i}"
        cand = sorted(by_q.get(qid, []), key=lambda h: -h["bitscore"])
        base = dict(seq=r["seq"], extended_mRNA=r["extended_mRNA"],
                    target_gene="", accession="", pct_identity="",
                    alignment_length="", evalue="",
                    annotation_method="NO_HIT", annotation_date=today)
        if not cand:
            rows.append(base)
            continue

        best = cand[0]
        best_gene = gene_from_title(best["title"])
        if best_gene is None:
            base["annotation_method"] = "UNPARSED_DEFLINE"
            base["accession"] = best["sid"]
            rows.append(base)
            continue

        runner_up = next(
            (h for h in cand[1:]
             if gene_from_title(h["title"]) not in (None, best_gene)),
            None,
        )
        if runner_up and (best["bitscore"] - runner_up["bitscore"]
                          < MIN_BITSCORE_MARGIN):
            base["annotation_method"] = "AMBIGUOUS"
            base["accession"] = best["sid"]
            rows.append(base)
            continue

        rows.append(dict(
            seq=r["seq"], extended_mRNA=r["extended_mRNA"],
            target_gene=best_gene, accession=best["sid"],
            pct_identity=best["pident"], alignment_length=best["length"],
            evalue=best["evalue"], annotation_method="BLAST_BEST_HIT",
            annotation_date=today,
        ))
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sirbench", required=True, type=Path)
    ap.add_argument("--backend", required=True,
                    choices=["local_blast", "ncbi_blast"])
    ap.add_argument("--db", default=None,
                    help="local BLAST database prefix (local_blast only)")
    ap.add_argument("--email", default=None,
                    help="identifying email (ncbi_blast only)")
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--output", required=True, type=Path)
    args = ap.parse_args()

    df = load_queries(args.sirbench).reset_index(drop=True)
    print(f"{len(df)} unique target windows to annotate")

    with tempfile.TemporaryDirectory() as td:
        fasta = Path(td) / "queries.fa"
        write_fasta(df, fasta)
        if args.backend == "local_blast":
            if not args.db:
                sys.exit("--db is required for local_blast")
            hits = run_local_blast(fasta, args.db, args.threads)
        else:
            if not args.email:
                sys.exit("--email is required for ncbi_blast")
            hits = run_ncbi_blast(fasta, args.email)

    rows = resolve(hits, df)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=OUTFIELDS)
        w.writeheader()
        w.writerows(rows)

    counts: dict[str, int] = defaultdict(int)
    for r in rows:
        counts[r["annotation_method"]] += 1
    ok = counts["BLAST_BEST_HIT"]
    print(f"\nwrote {args.output}")
    print(f"  annotated : {ok}/{len(rows)} ({ok / max(len(rows), 1):.1%})")
    for k, v in sorted(counts.items()):
        if k != "BLAST_BEST_HIT":
            print(f"  {k:<18}: {v}")
    print("\nReport the annotation rate PER SOURCE DATASET alongside any "
          "result that uses this file. Rows left unannotated must stay "
          "excluded from gene splits, not backfilled.")


if __name__ == "__main__":
    main()
