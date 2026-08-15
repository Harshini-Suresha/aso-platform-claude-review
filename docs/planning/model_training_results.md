# Model training specs — what was run, and what it found

Reports execution of `model_training_specs.md` M1–M7. One section per model:
what the spec asked for, what happened, and what is blocked.

Two models were runnable here (M2, M6). Two data defects the spec marks
"VERIFIED as broken" were confirmed against the committed data. The rest are
blocked on external data or model weights that are not in this repository,
and are listed with the specific thing that blocks them rather than skipped.

Environment: Python 3.11 was unavailable, so everything ran on 3.9 with
lightgbm 4.6.0, numpy 2.0.2, pandas 2.3.3, torch 2.8.0, ViennaRNA 2.7.0.
Seed 42 throughout.

---

## Summary

| Model | Status | Outcome |
|---|---|---|
| **M1** token cross-attention | **BLOCKED** | Needs `Hu.csv` and RNA-FM weights, neither in the repo. The re-annotation it depends on needs BLAST + a transcript DB. |
| **M2** LightGBM lambdarank | **RUN** | Acceptance PASSED. Best model is `regress-rank`, not lambdarank. |
| **M3** SpliceAI calibration | **BLOCKED** | No SpliceAI install; calibration reference set is MUST VERIFY. |
| **M4** NMD-exon classifier | **BLOCKED** | Needs a GENCODE release; MUST VERIFY. |
| **M5** uORF regressor | **BLOCKED** | Needs ribosome profiling data; MUST VERIFY. |
| **M6** Mondrian conformal | **RUN** | **Found and fixed an off-by-one that broke the coverage guarantee.** |
| **M7** OOD scorer | **BLOCKED** | Needs RNA-FM embeddings of training transcripts. |

---

## Data defects — both confirmed

The spec marks two defects "VERIFIED as broken" and says to fix them before
retraining. Both were checked against `data/benchmark/unified_benchmark.parquet`
rather than taken on trust, and both are real.

### `target_gene` on the siRNA rows

Confirmed, and **more specific than the spec states**. The spec says the
column "contains the siRNA sequence". It actually holds the **mRNA target
site** — the reverse complement of the guide, in DNA letters. Verified for
all 3,947 of 3,947 rows: reverse-complement match 3,947, direct match 0.

The distinction matters to whoever fixes it: you are looking for the gene the
target site belongs to, not the gene the guide came from.

3,947 rows, 3,947 distinct values. A split on that column is a random row
split.

### 106 sequences in two modalities

Confirmed exactly. 106 sequences appear in both `rnase_h` and
`splice_switching` — leakage along the axis a modality comparison tests.

### Effective n

Confirmed exactly as stated: 159,215 rows, 1,941 experiments, 339 genes,
67 cell lines.

### A guard that was passing on an average

`unified_gbm_baseline.py` carried a Phase-0 guard refusing a gene split when
rows-per-gene drops below 2.0. It was computing that **globally**:

| modality | rows | genes | rows/gene |
|---|---|---|---|
| rnase_h | 159,215 | 339 | 469.66 |
| **sirna** | **3,947** | **3,947** | **1.00** |
| splice_switching | 2,287 | 6 | 381.17 |
| **global** | 165,449 | 4,292 | **38.58** |

The global mean is 38.58, so the guard passed — on the strength of the
healthy arm, while the broken one sat at exactly 1.00. Now computed per
modality, and it correctly refuses.

---

## M2 — LightGBM lambdarank (RNase-H)

**Ran.** `backend/experiments/benchmark/m2_rnase_h_ranker.py`, 32 s.
Results in `backend/results/benchmark/m2_rnase_h_ranker.json`.

All three specified fixes applied: 106 dual-modality sequences dropped,
restricted to the RNase-H arm (the only one with real gene symbols), split by
gene with effective n reported as 339 genes.

| model | top-10 | 95% CI (over genes) | pooled Pearson | per-experiment Pearson |
|---|---|---|---|---|
| random guessing (computed) | **0.174** | — | — | — |
| lambdarank-rank | 0.296 | [0.268, 0.320] | 0.278 | 0.285 |
| regress-raw | 0.298 | [0.268, 0.323] | 0.270 | 0.297 |
| **regress-rank** | **0.302** | [0.272, 0.325] | 0.309 | 0.312 |

**Acceptance: PASS.** The CI lower bound (0.272) clears random guessing
(0.174).

### The random baseline was computed, and it landed on 0.174

The spec quotes 0.174. Simulating a random ranker over the actual test
groups gives **0.174** (sd 0.004, 50 trials) — independent agreement to
three decimals.

One correction along the way: the first implementation permuted a constant
vector, which leaves every value tied and hands `nlargest` the first k rows
in index order. That is not random guessing. Drawing fresh uniform scores per
trial gives the number above.

### Lambdarank is not the best model

`regress-rank` beats it, 0.302 against 0.296. The spec's own reference table
shows the same ordering (0.299 against 0.292), so this reproduces rather than
contradicts it — but M2 is titled "LightGBM lambdarank" and the honest
reading of its own cross-cutting rule ("if a model doesn't beat its baseline,
ship the baseline") is that **plain regression on the rank label should be
the shipped model**. It is simpler and it wins.

### The metric warning, partly resolved

The spec flags that pooled and per-experiment Pearson are not comparable, and
that pooled is inflated by between-experiment variance. Both are computed
here. On this split the gap is small and runs in **both** directions:

- lambdarank: pooled 0.278, per-experiment 0.285 (pooled *lower*)
- regress-rank: pooled 0.309, per-experiment 0.312 (pooled *lower*)

So on this data the inflation the spec warns about does not appear. That does
not make the two interchangeable — they answer different questions, and
per-experiment is the one the product asks — but the choice is not currently
worth a large number either way. Reported so the decision can be made on
evidence.

Bootstrap CIs resample **unique genes**, not rows. With 339 genes behind
159k rows a row-level bootstrap would report an interval roughly an order of
magnitude too narrow.

---

## M6 — Mondrian conformal predictor

**Ran.** `backend/experiments/benchmark/m6_conformal_audit.py`, ~5 s.
Results in `backend/results/benchmark/m6_conformal_audit.json`.

The spec describes this implementation as "VERIFIED as already implemented,
with caveats" and reports empirical coverage 0.887 at α = 0.10. Verifying it
by simulation rather than accepting that found a bug.

### The off-by-one

`q_hat` was the **ceil**(α·(n_cal+1))-th smallest calibration tau. The
guarantee needs the **floor**.

The calibration taus and the test tau are n+1 exchangeable draws, so the test
tau's rank among all n+1 is uniform. Coverage holds exactly when
`tau_test >= q_hat`, which for the m-th smallest of the other n means rank
≥ m+1. So

```
P(cover) = 1 - m/(n_cal + 1)
```

and 1−α needs `m <= α·(n_cal+1)` — the **largest** such integer, the floor.
Taking the ceil overshoots by one whenever α·(n_cal+1) is not an integer,
raising the threshold and dropping coverage below nominal.

Simulation at n_cal = 30, 200 runs per α:

| α | nominal | ceil predicts | **measured before fix** | floor predicts | **measured after fix** |
|---|---|---|---|---|---|
| 0.05 | 0.95 | 0.935 | 0.941 | 0.968 | **0.973** |
| 0.10 | 0.90 | 0.871 | 0.867 | 0.903 | **0.898** |
| 0.20 | 0.80 | 0.774 | 0.770 | 0.806 | **0.807** |

Every pre-fix measurement matches the ceil prediction and sits below nominal.
Every post-fix measurement matches the floor prediction and clears it. The
spec's own 0.887 is this same failure at a different n_cal, not a passing
result.

The audit tests against the exact finite-sample expectation rather than a
hand-picked tolerance. That mattered: the first version used an invented
slack and the α = 0.10 verdict landed 0.001 from flipping — a coin toss
deciding whether a guarantee holds.

### The guarantee is unavailable for two of three classes

| class | n_groups | calibration groups | guarantee |
|---|---|---|---|
| sirna | 6 | 3 | **unavailable** |
| splice_switching | 12 | 6 | **unavailable** |
| rnase_h | 100 | 50 | valid |

At α = 0.10 a non-trivial threshold needs at least 1/α − 1 = 9 calibration
groups. `conformal_topk` now returns `guarantee: "unavailable"` with the
reason instead of a coverage number, because a number there looks like a
guarantee and is not one.

**Do not fix this by pooling.** Pooling into RNase-H would produce RNase-H
guarantees wearing another label, which is precisely what Mondrian
calibration exists to prevent. Either gather more experiments per class,
raise α and say so, or report no guarantee.

### Stored results are stale, and cannot be regenerated here

Confirmed as the spec says:

| file | stored coverage | n_groups |
|---|---|---|
| `final_gc_auto/rnase_h/pipeline_result.json` | 0.04 | 100 |
| `final_gc_auto/sirna/pipeline_result.json` | 0.167 | 6 |
| `final_gc_auto/splice_switching/pipeline_result.json` | 0.0 | 12 |
| `ranker_v2/pipeline_result.json` | 0.0 | 12 |

These predate the fix and must not be quoted. Regenerating them means
retraining the ranker that produced them — a full pipeline run, not something
this audit can do. **Left in place rather than deleted**, because deleting
them would hide that published numbers were wrong; the audit output records
that they are void.

### Also fixed

`_bootstrap_ci` ran a 10,000-iteration Python loop per call, twice per
`conformal_topk`. Vectorised — same estimator, ~100× faster. It was the
reason the audit could not complete inside two minutes.

---

## Blocked models, and precisely what blocks them

None of these is skipped for convenience. Each needs something that is not in
this repository and that the specs mark MUST VERIFY.

### M1 — token cross-attention
- `OligoFormer/data/Hu.csv` is not in the repo.
- RNA-FM weights (`backend/pretrained/RNA-FM_pretrained.pth`) are not in the
  repo; `pretrained/` is gitignored.
- The embedding cache `backend/data/hu_embeddings.pt` does not exist.
- The gene split it must be evaluated under depends on the re-annotation
  below.

`backend/data_curation/annotate_sirna_genes.py` already exists and documents
this exactly. It needs either NCBI BLAST+ with a downloaded human transcript
FASTA, or hours of rate-limited remote NCBI BLAST with an identifying email.
**Which backend, which database release, and whose email are your calls** —
the remote route submits ~4,000 queries under your identity.

Its acceptance criteria are already strict (≥98% identity, ≥50 nt alignment,
best hit must beat the second-best different gene by ≥10 bitscore, otherwise
left NA). Nothing there should be loosened to raise the annotation rate.

### M3 — SpliceAI calibration
No SpliceAI installed. The calibration reference set is MUST VERIFY and the
spec warns specifically about picking a set SpliceAI was trained on
(GTEx/GENCODE overlap). Choosing it is a research decision.

### M4 — NMD-exon classifier
Needs a specific GENCODE release, marked MUST VERIFY with an explicit
instruction not to accept a recalled version number.

### M5 — uORF repression regressor
Needs public ribosome profiling paired with RNA-seq. The spec also requires
deciding *before starting* whether the target is main-ORF translation
efficiency or the uORF/main-ORF ribosome density ratio — they answer
different questions. That decision is not made.

### M7 — OOD scorer
Needs RNA-FM embeddings of all training transcripts, so it is blocked behind
the same missing weights as M1.

---

## Cross-cutting compliance

| Requirement | Status |
|---|---|
| Split by gene, always | M2 yes. M1 cannot until re-annotation lands; the guard now refuses rather than mislabelling. |
| Bootstrap CI over unique genes | M2 yes, over 339 genes. |
| Calibration for anything entering §3.2 | Not applicable to M2 (ranking) or M6 (already a coverage method). Outstanding for M3–M5 when they run. |
| Beat the stated baseline | M2 yes (0.302 vs 0.174, computed). |
| Seed 42, versions recorded | Yes — every result file carries package versions, git commit and full hyperparameters. |

---

## Open items this raised

- **SO-ML-01** — M2's shipped model should be `regress-rank`, not
  lambdarank. It wins on the spec's own metric and is simpler.
- **SO-ML-02** — pooled vs per-experiment Pearson: pick one for publication.
  The gap is small here and does not favour either, so the choice should be
  made on which question you are answering, not on which number is larger.
- **SO-ML-03** — the conformal guarantee is unavailable for siRNA and
  splice-switching. Decide between gathering more experiments, raising α, or
  publishing "no guarantee" for those classes. Pooling is not an option.
- **SO-ML-04** — the stale `pipeline_result.json` files need a full pipeline
  rerun. Until then any coverage figure in the paper drawn from them is void.
- **SO-ML-05** — the siRNA re-annotation backend, database release and
  contact email need deciding before M1 can be evaluated honestly.
