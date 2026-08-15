# Model training specifications

Companion to `scoring_and_ml_plan.md`. One section per model, written so
training can be run on a separate system without access to this repo.

## Provenance of the numbers below

| Marked | Meaning |
|---|---|
| **VERIFIED** | taken from committed results or code in `aso-platform-claude-review` @ `f26dec2` |
| **PROPOSED** | my recommendation; a starting point, not a tuned result |
| **MUST VERIFY** | you must confirm the specific dataset accession / version yourself before use. Do not accept an accession number from any AI assistant, including me, without checking it |

Standing project rule applies throughout: never hard-code a PMID, GEO
accession, or dataset version recalled from memory. Look it up, confirm it,
then write it down.

---

# M1 — Token cross-attention (siRNA efficacy)

**Status: retrain, do not rebuild.** This is the best model in the repo.

### Purpose
Predict siRNA knockdown efficacy. Feeds `Y` (feasibility / yield) for the
siRNA arm of L3. Not a headline model.

### Data — VERIFIED
- Hüsken et al. siRNA set, 2,361 rows after filtering, via
  `github.com/lulab/oligoformer`, `data/Hu.csv`
- Label: normalised knockdown, continuous

### Critical fix before retraining — VERIFIED as broken
In `unified_benchmark.parquet` the `target_gene` column for siRNA rows
contains **the siRNA sequence**, not a gene symbol (3,947 distinct "genes"
for 3,947 rows). Any split on that column is a plain random row split.

Re-annotate from the source datasets (Hüsken, Reynolds, Ui-Tei, Takayuki,
Vickers, Amarzguioui, Harborth, Shabalina all carry real target-gene
annotations), then split by gene. **Expect the reported Pearson to fall.**
The current 0.626 is a random-split number.

### Architecture — VERIFIED
```
RNA-FM embeddings (640-dim, rna_fm_t12, layer 12, per-token)
  ├─ aso_proj:    Linear(640 → 256)
  └─ target_proj: Linear(640 → 256)
       ↓
  LayerNorm + learned positional embeddings
       ↓
  Cross-attention: ASO tokens as query, target tokens as key/value
       d_model=256, n_heads=8, dropout=0.2
       ↓
  Self-attention over ASO tokens (same dims)
       ↓
  Mean pool → 256
       ↓
  concat( accessibility 11-dim, handcrafted 9-dim ) → 276
       ↓
  MLP head: 276 → 256 → 128 → 64 → 1
```
Transformer block internals: `MultiheadAttention(batch_first=True)`,
pre-norm `LayerNorm`, FFN expansion 4×, dropout 0.2 on both FFN layers.

Input shapes: `aso_tokens [N, 19, 640]`, `mrna_tokens [N, 57, 640]`,
accessibility `[N, 11]`, handcrafted `[N, 9]`.

### Training — VERIFIED
| Parameter | Value |
|---|---|
| optimiser | Adam |
| learning rate | 1e-3 |
| weight decay | 1e-5 |
| batch size | 32 |
| epochs | 100 |
| early stopping patience | 10 |
| scheduler | none |
| loss | MSE |
| CV | 5-fold, seed 42, per-fold seed = 42 + fold |

### Reference results — VERIFIED (random split)
| model | mean Pearson | sd |
|---|---|---|
| ViennaRNA accessibility only | 0.119 | 0.061 |
| handcrafted only (9-dim) | 0.297 | 0.051 |
| RNA-FM + accessibility | 0.537 | 0.039 |
| RNA-FM + handcrafted | 0.551 | 0.025 |
| FusionNet (all three) | 0.552 | 0.018 |
| **RNA-FM alone** | **0.564** | 0.010 |
| cross-attention | 0.584 | 0.024 |
| **token cross-attention** | **0.626** | 0.027 |

Also: R² 0.370 ± 0.041, MSE 0.0141 ± 0.0007, MAE 0.0934 ± 0.0024.

### Acceptance criteria
1. Beats RNA-FM-alone **under the gene split**, not the random split.
2. If it doesn't, ship RNA-FM + linear head instead. Simpler and honest.
3. Report a bootstrap CI over unique target genes, not rows.

### Known pitfall — VERIFIED
Adding ViennaRNA accessibility to RNA-FM *lowers* performance
(0.564 → 0.537). Don't assume more features help. Run the ablation before
committing to the 276-dim concat.

---

# M2 — LightGBM lambdarank (RNase-H efficacy)

**Status: keep, retrain after data fixes.** Matches or beats the neural
ranker at 1/14th the training time.

### Purpose
Predict relative potency within an experiment. Feeds `Y` for the RNase-H arm.

### Data — VERIFIED
`unified_benchmark.parquet`, `modality == "rnase_h"`: 159,215 rows,
1,941 experiments, 339 target genes, 67 cell lines. Source: `aso_atlas`
(patent-derived inhibition tables).

### Fixes required first — VERIFIED as broken
1. 106 sequences appear in **both** `rnase_h` and `splice_switching`. Remove
   or assign to one modality — this is leakage along the axis you're testing.
2. No modality rebalancing exists anywhere. If training multi-modality,
   stratify sampling by modality, not by table.
3. Report effective n as unique target genes (339), not rows (159,215).

### Features — VERIFIED
4-mer counts, 256-dim (`kmer_features(seqs, k=4)`), plus chemistry ID.

### Hyperparameters — VERIFIED
```python
objective       = "lambdarank"
metric          = "ndcg"
learning_rate   = 0.1
num_leaves      = 63
min_data_in_leaf= 20
num_boost_round = 200
seed            = 42
```
Grouping: `experiment_id`. Label: `ceil(rank_label / 10)` as integer relevance.
Split: 25% of target genes held out.

### Reference results — VERIFIED
| model | top-10 | pooled Pearson |
|---|---|---|
| random guessing (computed) | **0.174** | — |
| lambdarank on rank label | 0.292 | 0.289 |
| regression on raw label | 0.285 | 0.274 |
| regression on rank label | 0.299 | 0.307 |
| neural ranker v2 (504 s) | 0.297 | — |
| neural ranker v3 (6,898 s) | 0.269 | — |

**Metric warning.** The GBM script computes one *pooled* Pearson across all
test rows; `invariant_ranker` computes a weighted mean of *per-experiment*
Pearsons. These are not comparable — pooled correlation is inflated by
between-experiment variance. Compare on top-10 only, and fix one of the two
implementations before publishing either.

### Acceptance criteria
1. Top-10 materially above 0.174 under a real gene split.
2. Any neural alternative must beat this, on this metric, on this split.
3. Bootstrap CI over unique genes.

### PROPOSED tuning grid
`learning_rate` {0.03, 0.05, 0.1} × `num_leaves` {31, 63, 127} ×
`min_data_in_leaf` {20, 50, 100} × `num_boost_round` {200, 500, 1000} with
early stopping on a validation gene split. Also try `k` = 3 and 5 for k-mers,
and adding duplex ΔG as a single scalar feature (cheap, testable).

---

# M3 — SpliceAI calibration map

**Status: new, cheap, and a contribution in its own right.**

### Purpose
Convert raw SpliceAI delta scores into calibrated probabilities. Required
because section 3.2 of the plan combines features *as probabilities*, and
SpliceAI outputs are uncalibrated network activations that the field
routinely thresholds at 0.2 / 0.5 / 0.8 as if they were probabilities.

This is a calibration fit, not a trained network. Hours, not days.

### Inputs
- SpliceAI delta scores: acceptor gain, acceptor loss, donor gain, donor loss
- MUST VERIFY: SpliceAI version, and whether you use the pip package,
  the Illumina repository, or precomputed score files. Record which.

### Calibration reference set — MUST VERIFY
You need variants with a *known* splicing outcome:
- ClinVar variants with splicing-related molecular consequences and a
  confident review status
- RNA-seq-validated splice events from published cohorts

Do not use a set that SpliceAI was trained on. Check the SpliceAI training
split before choosing — GTEx/GENCODE overlap is the obvious trap.

### Method — PROPOSED
1. Stratify by consequence class (acceptor gain / acceptor loss / donor gain
   / donor loss). Fit **separately per class** — a delta of 0.4 does not mean
   the same thing across classes.
2. Fit isotonic regression (monotone, non-parametric, no shape assumption).
   Fit Platt scaling as a comparator.
3. Evaluate with expected calibration error and a reliability diagram, on a
   held-out split.
4. Select whichever gives lower ECE **and** remains monotone.

### Acceptance criteria
- ECE below 0.05 per consequence class on held-out data.
- The reliability diagram is publishable as a figure. If it isn't, the
  calibration failed and you should say so rather than shipping it.

### Register
CAL-NEW-02: method, reference dataset, version, stratification scheme.

---

# M4 — NMD-exon (poison exon) classifier

**Status: new. Phase 5 upside, NOT on the critical path.**

Under the annotation-first design, most genes resolve from GENCODE. This
model only fires where annotation is absent, and its output carries the
PREDICTED provenance tier with a confidence cap.

### Purpose
Given an exon and its flanking intronic sequence, predict the probability
that its inclusion triggers nonsense-mediated decay. Supplies F4.

### Data — MUST VERIFY each source
**Positives.** Exons unique to GENCODE transcripts with biotype
`nonsense_mediated_decay`. Verify the GENCODE release and record it. Expect
thousands of exons, but check the number yourself — do not take mine.

**Negatives.** Exons appearing only in `protein_coding` transcripts of the
same genes. Matching within gene controls for gene-level confounds
(expression, GC, conservation).

**Optional strengthening.** Public UPF1-knockdown or NMD-inhibition RNA-seq,
where NMD targets stabilise on knockdown. This turns a biotype-annotation
label into a measured one. You must locate and verify the specific accessions
— I am not going to name any from memory.

### Split
**By gene**, not by exon. Exons from one gene are not independent. Report
effective n as unique genes.

### Features — PROPOSED
- Exon sequence + 200 nt flanking intron each side
- Frame: does inclusion shift the reading frame?
- Distance from the resulting stop codon to the final exon-exon junction —
  **the 50–55 nt rule is the dominant biological signal here** and must be an
  explicit feature, not something the model is asked to discover
- Exon length; exon length mod 3
- Splice-site strength at both boundaries (MaxEntScan or SpliceAI)
- Conservation (phyloP or phastCons) over the exon

### Architecture — PROPOSED, in order of what to try
1. **Gradient-boosted trees on the features above.** Try this first. With an
   explicit frame/distance feature the problem may be largely solved by rules
   plus a small model, and you should find that out before building anything
   larger.
2. RNA-FM embeddings of the exon + flanks → linear or GBM head.
3. Small 1D CNN over one-hot sequence, only if 1 and 2 both plateau.

### Loss and imbalance
Binary cross-entropy. Positives will be the minority — use
`scale_pos_weight` (GBM) or `pos_weight` (PyTorch) set to the inverse class
frequency, and report precision-recall AUC, not ROC-AUC. ROC-AUC flatters
imbalanced classifiers.

### Acceptance criteria
1. PR-AUC materially above the positive base rate on a **gene-level** split.
2. Calibrated — this output enters a probability calculation. Fit isotonic
   calibration on a held-out split and report ECE.
3. If GBM on features matches the deep model, ship the GBM.

---

# M5 — uORF repression strength regressor

**Status: new. Phase 5 upside, NOT on the critical path.**

### Purpose
Given a 5′ UTR and a detected upstream ORF, predict how strongly it
suppresses translation of the main ORF. Supplies F5.

Note the existing `_scan_uorfs` in `gene_feature_service.py` already finds
upstream AUGs. It reports presence. This model reports *strength*, which is
what determines whether blocking the uORF is therapeutically worthwhile.

### Data — MUST VERIFY
Public ribosome profiling paired with RNA-seq, from which translation
efficiency (ribosome-protected fragments over mRNA abundance) is computed per
transcript. Locate and verify the specific datasets yourself.

Target: translation efficiency of the main ORF, or the ratio of uORF to main-
ORF ribosome density. **Decide which before you start** — they answer
different questions and are not interchangeable.

### Features — PROPOSED
- Kozak context strength at the uORF start codon
- Distance from cap to uORF start
- Distance from uORF stop to main ORF start
- uORF length; whether it overlaps the main ORF start
- Number of uORFs in the 5′ UTR
- 5′ UTR length, GC content, and folding ΔG (ViennaRNA — appropriate here,
  unlike in M1)
- Start codon identity (AUG vs near-cognate)

### Architecture — PROPOSED
Gradient-boosted regression on the features above. This is a small-data,
well-understood-biology problem; a deep model is unlikely to help and will be
harder to audit.

### Split
By gene. Never by uORF — one 5′ UTR often contains several.

### Output mapping
The score must become a probability for section 3.2. Fit a monotone map from
predicted repression strength to `P(this uORF meaningfully represses)` using
a validation set with known outcomes, and register the threshold as a
calibration parameter.

### Acceptance criteria
1. Spearman against held-out translation efficiency, gene-split, with a
   bootstrap CI over genes.
2. Beats a baseline of "Kozak strength alone" — if it doesn't, use Kozak
   strength and say so.

---

# M6 — Mondrian conformal predictor

**Status: not trained. Calibrated on a held-out split.**

### Purpose
Produce mechanism sets with a coverage guarantee, and trigger ABSTAIN.

### Method — VERIFIED as already implemented, with caveats
The implementation in `invariant_ranker.py::conformal_topk` is now correct:
nonconformity is the predicted score of the weakest true top-k member, and
`q_hat` is the `ceil((n_cal + 1) × alpha)`-th **smallest** calibration tau.
I confirmed numerically: empirical coverage **0.887** at α = 0.10.

Two things to fix before use:
1. **Stored results are stale.** `final_gc_auto/*/pipeline_result.json` still
   reports coverage 0.04 / 0.167 / 0.0 from before the fix. Rerun.
2. **`n_groups` is 6 (siRNA) and 12 (splice).** At α = 0.1 you need at least
   `1/alpha − 1 = 9` calibration groups for a non-trivial threshold, and
   realistically many more. Below that the guarantee is vacuous. Either
   pool, raise α, or report that no guarantee is available.

### Mandatory: Mondrian, not global
Calibrate **per mechanism class**. Global conformal over a 96%-RNase-H
dataset produces RNase-H guarantees wearing another label.

### Parameters
| Parameter | Value |
|---|---|
| α | 0.10 (report 0.05 and 0.20 as sensitivity) |
| calibration split | 50% of groups, per class |
| minimum groups per class | ≥ 20; below that, report "no guarantee" |

### Reporting
A coverage/abstention curve, not a point estimate:
*"declines X% of cases; on the remainder achieves Y at 90% guaranteed
coverage."*

---

# M7 — Out-of-distribution scorer

**Status: fitted, not trained.**

### Purpose
Decide whether a new gene is close enough to the training distribution for
any prediction to be meaningful. Drives ABSENT rather than PREDICTED.

### Method — PROPOSED
1. Embed all training transcripts with RNA-FM (frozen).
2. For a query, compute k-nearest-neighbour distance (k = 10) in that space.
3. Threshold at a high percentile of the training-set self-distance
   distribution — 95th as a starting point.
4. Beyond threshold → SC-EF returns **ABSENT**, not a low value.

### Alternative worth testing
The retired CVAE's encoder reconstruction error is a legitimate OOD score.
This is the one honest use for that model, and it costs nothing since it's
already trained.

### Acceptance criteria
Held-out genes from an unseen gene family should score as OOD at a materially
higher rate than held-out genes from seen families. If they don't, the
embedding space isn't capturing what you need and the threshold is arbitrary.

---

# Cross-cutting requirements

Apply to every model above.

### Splitting
**By gene, always.** Never by row, never by sequence. Report effective n as
unique genes. Where a benchmark spans modalities, stratify.

### Uncertainty
Bootstrap confidence intervals over **unique genes**, not rows. With 339
genes (RNase-H) or ~7 unique gene/mechanism pairs (mechanism recovery), point
estimates are not reportable on their own.

### Calibration
Any model whose output enters section 3.2 must emit a calibrated probability.
Fit isotonic calibration on a held-out split; report ECE and a reliability
diagram. An uncalibrated score fed into probability arithmetic is a category
error, and it is the single most likely source of a wrong number in this
system.

### Baselines to beat, per model
| Model | Baseline |
|---|---|
| M1 | RNA-FM + linear head (0.564 random-split) |
| M2 | random guessing (top-10 = 0.174) |
| M3 | uncalibrated raw SpliceAI score |
| M4 | frame + 50 nt rule as a hand-written rule, no model |
| M5 | Kozak strength alone |
| M7 | random abstention at the same rate |

If a model doesn't beat its baseline, ship the baseline. That is a result,
not a failure, and reporting it honestly is worth more than a marginal model.

### Reproducibility
Seed 42 throughout, per-fold seed = 42 + fold. Record: dataset version and
accession, package versions (`torch`, `lightgbm`, `ViennaRNA`, RNA-FM
checkpoint hash), git commit, and full hyperparameters, alongside every
result file. The project's auditability rule applies to models exactly as it
applies to rules: no number without a traceable origin.

### What to hand back
For each model: checkpoint, the exact config used, per-fold metrics with
seeds, a calibration curve, and the baseline comparison. A single headline
number without these cannot be integrated into the scoring system, because
the confidence cap has nothing to attach to.
