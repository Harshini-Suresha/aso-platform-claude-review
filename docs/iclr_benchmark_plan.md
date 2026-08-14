# ICLR 2027 (MAIN TRACK) — ASO Platform Research Plan

Status: PILOT DONE — STRATEGY REVISED 2026-08-11
Last updated: 2026-08-11

## User mandate

- MAIN TRACK ONLY (no workshops, no D&B, no journal fallback). Confirmed
  2026-08-11: "i want main track only."
- COMPUTE: NCBS cluster access (GPU). Use it for foundation-model axis
  (Evo / Nucleotide Transformer) + large-scale training. Local MPS is
  fallback only.
- I must be honest about odds (see Risks).

## PILOT RESULTS (2026-08-11) — ASO Atlas learnabilityData: `barneyhill/aso_atlas` cloned to
`/var/folders/.../T/opencode/aso_atlas/` (data/aso_atlas.pkl, 190,927 rows).
Pickle needs the repo's `src` package on sys.path to load.

- 190,927 rows, 343 genes, sequences 12-28 nt (mean 18.2), 451 chemistry
  fingerprints, 2,406 steric-blocking rows (excluded), 25k dup sequences,
  43 dosage levels, cell-line naming inconsistent (A431 vs A-431).
- Labels NOISY: inhibition_percent range -786 to +224 (should be 0-100).
- target_mrna column = gene NAMES only (e.g. "APP"), NOT sequences. No
  target-position context. (OligoAI authors claim they model "RNA target
  context" — they must reconstruct it elsewhere.)
- Learnability (HistGradientBoosting, 4-mer + chemistry one-hot + length/GC/dosage):
  - Random split:   Pearson 0.488, R2 0.224
  - Gene-split 10%: Pearson 0.387
  - Gene-split 25%: Pearson 0.278
  → Real but noisy signal; honest ceiling ~0.3-0.5. Neural + RNA-FM could
    plausibly reach ~0.4-0.5 on gene splits.

## CRITICAL COMPETITIVE DISCOVERY

The ASO Atlas authors ALREADY published a model: **OligoAI** (bioRxiv
2025.10.29.685292, Hill et al., Oxford + MRC NATA + Broad). It:
- jointly models RNA target context + ASO sequence + sugar/backbone chemistry + dosage,
- wet-lab validated (KCNT2, 5.72x screening-effort reduction),
- has an open web tool (sitlabs.org/OligoAI) + HF model + code.

CONSEQUENCE: "first chemistry-conditioned ASO model" / "first large ASO
benchmark" are TAKEN. We cannot win on those claims. We must win on METHOD.

## Revised strategy: method-first, NOT benchmark-first

Working title: calibrated top-k candidate selection under noisy, heterogeneous
assay data. Novel method = weak-to-strong recipe:
1. Ranking/contrastive weak supervision on 188k noisy patent labels
   (within-experiment/within-gene relative ranks — patent labels are garbage
   in absolute terms; rank is the signal). Contrast: OligoAI regresses raw %.
2. Chemistry-conditioned representation + domain alignment across modalities
   (siRNA Huesken/Taka → gapmer ASO Atlas) — cross-modality transfer.
3. Conformal/calibrated TOP-K COVERAGE guarantees for candidate ranking —
   the design decision is "pick top 10 with a guarantee the best is in the
   set." Nobody in this field does this; very ICLR-appropriate.
4. Leakage audit as a quantified finding (random vs gene vs patent-table splits).

Evaluation must BEAT: OligoAI (or a faithful re-implementation), OligoFormer,
DeepSilencer, RNA-FM-MLP, gradient boosting, + show transfer + coverage
guarantees hold.

## Constraints

- Compute: **Nargis = CPU-only SGE cluster** (63×16 cores, Python 2.7, no GPU).
  No Evo / Nucleotide Transformer anywhere. Foundation-model axis is DROPPED.
  - Nargis: data preprocessing, k-mer/thermo features, classical baselines
    (XGB/RF/SVR) parallel CV, batch via short.q/medium.q/all.q.
  - Mac MPS (torch 2.2.2): small-scale neural training on SUBSAMPLED data
    (~30-50k rows). Full 188k transformer training is not feasible CPU-side.
  - Design consequence: ranking pretraining uses cheap one-hot/learned token
    embeddings (CPU-friendly), NOT RNA-FM. RNA-FM embeddings only where they
    already exist (Huesken/Taka caches) or for small clean sets.
- Working env (local): repo root `.venv` (torch 2.2.2, pandas 2.3.3, sklearn,
  ViennaRNA, yaml).
- Time: ~6 weeks to ICLR 2027 main-track deadline (~late Sept 2026).

## Roadmap (revised, method-first, GPU-enabled)

1. [x] PILOT: ASO Atlas feasibility + learnability (done above)
2. [ ] Data pipeline: clean ASO Atlas (filter steric, dedup, clip/normalize,
     within-table rank labels); add siRBench + Huesken/Taka/Mix; unified schema.
3. [ ] Ranking weak-supervision training on ASO Atlas; ablations vs regression.
4. [ ] Chemistry-conditioned TokenCrossAttention (ASO-seq-only variant +
     target-context variant where target seq available).
5. [ ] Cross-modality transfer eval (siRNA→gapmer) + leakage audit.
6. [ ] Conformal top-k coverage wrapper + calibration eval.
7. [ ] Foundation-model axis: DROPPED (CPU-only). RNA-FM comparison only
     where caches exist.
8. [ ] Beat OligoAI (reproduce + improve) + all baselines.
9. [ ] Paper (method-first framing) + HF/code release.

## Key risks (honest)

- ICLR main track acceptance ~25% for established labs; for this plan with
  ~6 weeks and no wet-lab, realistic odds LOW (~10-20%). Will say so plainly.
- OligoAI + wet-lab validation is a strong published baseline that reviewers
  will cite. Differentiation must be crisp.
- No target-position context in ASO Atlas limits target-aware modelling.
- MPS compute may slow experiments; 188k rows × RNA-FM token embed is heavy.

## DE-RISK #2 (2026-08-11) — ranking vs regression on noisy labels

Code: backend/experiments/benchmark/aso_rank_vs_regress.py
Results: backend/results/benchmark/aso_rank_vs_regress.json
Setup: cleaned ASO Atlas (172,580 rows), gene split 75/25, within-table ranking.
Models: LightGBM regress-raw / regress-rank / LambdaRank-raw / LambdaRank-rank.

| model | within-table Spearman | top-10 overlap | Pearson(rank) |
|---|---|---|---|
| regress-raw (OligoAI-style) | 0.310 | 0.284 | 0.265 |
| regress-rank (surrogate) | 0.310 | 0.291 | 0.324 |
| lambdarank-raw | 0.286 | 0.285 | 0.275 |
| lambdarank-rank | 0.290 | 0.283 | 0.305 |

FINDINGS:
- Ranking TARGET beats raw regression: regress-rank > regress-raw (Pearson
  +0.06, top-10 +0.007). Central weak-supervision claim holds in direction.
- BUT LambdaRank (decile-discretized, 200 rounds) does NOT beat the
  regression surrogate — GBM ranking needs more work to be the paper's method.
- Absolute numbers are weak (Spearman ~0.3, top-10 overlap 0.29 ≈ 2.9/10 vs
  1.0/10 chance). Label noise is brutal. NEED: neural pairwise ranker +
  chemistry conditioning to push past GBM, or the headline result is weak.
- NEXT: (a) small neural chemistry-conditioned ranker (pairwise hinge) on
  ASO Atlas; (b) ingest siRBench + Huesken/Taka/Mix for cross-modality
  transfer eval. Compute feasible on MPS at subsample scale.

Cleaning infra: backend/data_curation/aso_atlas.py → cleaned parquet in
backend/data/benchmark/aso_atlas_clean.parquet (172,580 rows, 340 genes,
2,006 patent tables, 418 chem fingerprints, rank_label = within-table pct).

## CLUSTER DEPLOYMENT KIT (2026-08-11)

Files in backend/experiments/benchmark/cluster/:
- setup_env.sh       — builds miniconda python3.9 + CPU torch env on shared storage
                      (/cluster/share/$USER/aso-env). Has conda-pack fallback for
                      no-internet clusters.
- run_ranker.qsub    — SGE job: short.q, -pe shm 16, h_vmem=4G/slot. Runs the
                      full neural ranker (1M pairs, 25 epochs) → results/benchmark/.
- deploy_to_cluster.sh — run on LAPTOP; rsyncs code + 4.2MB cleaned parquet.

Neural ranker: backend/experiments/benchmark/neural_ranker.py
- CPU-first: one-hot ASO tokens → 1D-CNN (3nt) → seq emb(48) + chemistry
  embedding(16) + scalars(length/GC/log-dosage) → MLP → score.
- Within-table pairwise MarginRankingLoss (weak supervision, ranking target).
- Gene 75/25 split, eval = within-table Spearman + top-10 overlap + Pearson.
- Sized so FULL run ≈ 15-30 min on a 16-core Nargis node (inside short.q).

To run:
  1. laptop: bash deploy_to_cluster.sh
  2. cluster: ssh login; bash .../cluster/setup_env.sh (once)
  3. cluster: qsub .../cluster/run_ranker.qsub ; qstat
  4. send back results/benchmark/neural_ranker_full/metrics.json

If -pe shm is invalid on Nargis, use -pe orte 16 instead.

## REFRAME FOR MAX NOVELTY (2026-08-11) — confirmed by user

Rejected framing (incremental application → ICLR rejection risk):
  "ranking + chemistry conditioning applied to ASO patents."

NEW research question (the actual contribution):
  **Do sequence-activity rank models generalize across CHEMISTRY and
  MODALITY?** (MOE→cEt gapmer? siRNA→gapmer? where/why do they break?)

Paper shape:
  *Title (working)*: Chemistry-invariant ranking and calibrated selection
  for RNA therapeutics from noisy assay corpora.

Contributions:
1. Unified cross-modality benchmark: ASO Atlas (cleaned) + siRBench +
   Huesken/Taka/Mix, one schema, within-experiment RANK labels (weak
   supervision), cross-chemistry + cross-modality protocols.
2. CHEMISTRY-INVARIANT RANKING (the method): domain-adversarial (GRL)
   representation learning over sequence tokens with a within-table
   ranking target. Claim: invariance beats conditioning for held-out
   chemistry (conditioning overfits chemistry-specific label noise).
3. CALIBRATED TOP-K UNDER SHIFT: weighted conformal prediction
   (Tibshirani 2019) with density-ratio weights across chemistry shift;
   finite-sample coverage guarantees — the theory spine.
4. Findings: cross-modality transfer, leakage audit (random vs gene vs
   table), when ranking targets help (batch-effect robustness).

Deliberately NOT claimed: "first ASO model" (OligoAI owns that), "ranking
losses are new" (they aren't). Claim is the PACKAGE + the surprising
invariance result + shift-robust calibration.

Key experiments (CPU-feasible):
 A. Cross-chemistry transfer matrix (train on chem X, test on chem Y) —
    invariant vs conditioned vs masked vs no-chem. Matrix over top ~6
    fingerprints.
 B. Cross-modality: Huesken/Taka (siRNA, unmodified) → ASO Atlas gapmers.
 C. Weighted-conformal top-k coverage under chemistry shift (nominal 90%).
 D. Leakage audit table.

Next build steps:
 1. unified ingestion (siRBench + Hu/Taka/Mix into one parquet, rank labels)
 2. chemistry-invariant ranker (DANN GRL) — extend neural_ranker.py
 3. conformal top-k wrapper
 4. cross-chemistry + cross-modality harness → Nargis runs

## LITERATURE VERIFICATION (2026-08-12) — mechanism-conditioned transfer is OPEN

Verified against the actual literature (not memory).

COMPETITORS CHECKED:
- eSkip-Finder (Chiba et al., NAR 2021, updated 2024): ML + database for
  EXON-SKIPPING (splice-switching) ASOs. SEPARATE per-mechanism platform.
  Training set ~298 unique ASOs / ~566 skipping values, essentially all
  DMD/dystrophin (searchable DB lists dystrophin, dysferlin, myostatin).
  Data is WEB-SEARCHABLE ONLY (PostgreSQL backend) — no bulk download;
  acquire via scraping the search API or emailing authors.
- ASOptimizer: separate platform for RNase-H degradation (gapmer) ASO design.
- ASO-RASAR (July 2026): 59,273 gapmer ASOs (5-10-5 MOE, 3-10-3 cET), 30
  genes; benchmarks gene-specific vs CROSS-TARGET prediction. Still
  SINGLE-mechanism (gapmer only) → does NOT undercut us.
- 2025 review (Leckie & Yokota, preprints 202501.0135): explicitly names
  generalizability as the OPEN LIMITATION of both eSkip-Finder and
  ASOptimizer ("validated using data from only one or two ASO targets,
  raising questions about generalizability"). Citable abstract language.

CONCLUSION: mechanism-conditioned cross-modality transfer (RNAi → RNase-H →
steric-block/splice-switching) in ONE shared model is NOT done anywhere.
The core novelty claim HOLDS. Architecture (cross-attention/FiLM/GRL) stays
demoted to implementation detail, as established above.

DATA-PLAN CORRECTION (required for honesty):
- Splice-switching modality = (a) re-include ASO Atlas steric-blocking rows
  (2,406, patent-noisy; requires re-cloning barneyhill/aso_atlas) + (b)
  eSkip-Finder experimental set (scrape web DB or email Chiba/Yokota).
- CRITICAL CONFOUND: splice-switching data is DMD-skewed → mechanism ≈ gene.
  This MUST be presented as a MEASURED finding (mechanism↔gene confound audit
  column in the cross-modality matrix), not a hidden flaw.
- Headline finding reframed: "where does a shared mechanism-conditioned
  ranker transfer, and where does it break under the mechanism↔gene
  confound?" — an empirical finding, not a benchmark boast.
- eSkip-Finder + ASOptimizer MUST be cited and differentiated in related work
  (same rule as RaptGen/CrossLLM-Mamba): they optimize PER-mechanism with
  single-target validation; we condition ONE shared model on a mechanism
  taxonomy and test transfer ACROSS modalities. Differentiate explicitly,
  don't omit.

TITLE (locked 2026-08-12):
  Mechanism-Conditioned Transfer Across Heterogeneous RNA-Targeting Modalities

## GENERATIVE PIVOT (2026-08-12) — user decided: generative design, not just transfer

Transfer-to-RANKING is kept as the acceptance stage; the paper's headline
moves to transfer-to-GENERATION. This is strictly stronger: generation is a
harder, more novel claim than ranking, and it reuses every existing part.

NEW TITLE (locked):
  Mechanism-Conditioned Generative Design Across Heterogeneous
  RNA-Targeting Modalities

CONTENT ADDITIONS (what makes the generative claim novel, not just the title):
1. CONTROLLABLE MECHANISM RE-CONDITIONING (centerpiece): CVAE/autoregressive
   generator conditioned on (mechanism, chemistry, target); adversarial
   disentanglement forces mechanism to be a CONTROLLABLE axis, not an input.
   Flagship experiment: take a sequence known to work as a gapmer, re-condition
   the latent to the splice-switching mechanism, and validate the generated
   candidates' rank distribution on the eSkip-Finder/steric set. No one does
   controllable mechanism-conditioned oligo generation.
2. RANKING-AWARE GENERATIVE TRAINING: train the generator with PREFERENCE
   signals from within-experiment ranks (pairwise/DPO-style), not raw labels.
   Extends the noisy-label weak-supervision thesis from ranking to generation.
3. GENERATE -> RANK -> CALIBRATED-ACCEPT PIPELINE: generator proposes, the
   existing invariant ranker scores, the conformal wrapper accepts top-k with
   finite-sample coverage under mechanism shift. The theory spine (weighted
   conformal, Tibshirani 2019) now applies to GENERATION, not just ranking.
4. CROSS-MODALITY GENERATION-TRANSFER BENCHMARK: train on gapmer (159k),
   generate conditioned on splice-switching (tiny, DMD-skewed). Metrics:
   (a) chemistry-aware validity (motif, length, gap composition), (b) rank
   transfer of generated candidates, (c) mechanism<->gene confound audit.
5. ABLATION: conditioning vs invariant vs RE-CONDITIONING — the GRL invariance
   story flips to "what happens when we force mechanism into the latent vs
   strip it." ICLR-flavored analysis section.

HONEST COSTS:
- NEW: generator (small CVAE/autoregressive; CPU/MPS-feasible at subsample
  scale on 188k gapmer rows).
- NEW: chemistry-aware validity filter + metrics.
- REUSE: invariant_ranker.py becomes the acceptance stage; conformal_topk()
  unchanged.
- RISK: generation eval on the tiny splice target is noisy — that IS the
  transfer claim, so report with confidence intervals, and keep the confound
  audit front and center.

TITLE ALTERNATES (do NOT lock):
- "Re-Conditioning Across Mechanisms: Controllable Generative Design for RNA
  Therapeutics" — signals the centerpiece if we want the subtitle.
- "One Model, Many Mechanisms" — talk/social-media title only; too light for
  ICLR main track.

## BUILD STATUS (2026-08-12) — generative pipeline v1 implemented + smoke-tested

Code (backend/experiments/benchmark/):
- generative_design.py — mechanism-conditioned CVAE: Conv1D encoder, GRU
  decoder, length head, mechanism+chemistry conditioning WITH dropout
  (p_mech_drop, enables unseen-mechanism transfer), pairwise ranking-aware
  reconstruction (margin on within-experiment recon loss). CLI modes:
  train / generate / eval / pipeline.
- invariant_ranker.py — added --save_model, save_checkpoint(), load_scorer(),
  score_df() (OOV-chemistry fallback to mean embedding) so it can serve as the
  acceptance stage.

Smoke results (2-epoch subsample; sanity only):
- Train: recon 1.36→1.38 vs entropy floor 1.386 → real signal, more epochs needed.
- Generate (mechanism_oov, chem_oov): purity 1.0, length-in-range 1.0,
  GC-in-range 0.955, homopolymer 1.0, novelty 1.0 — validity holds even for
  the UNSEEN mechanism, confirming the dropout design.
- Re-conditioning (encode 20 top-ranked gapmers, decode under mechanism_oov):
  valid sequences, novelty 1.0.
- Pipeline (generate->rank->accept): runs end-to-end; 3-epoch ranker gives
  ~0 score lift (expected — undertrained). Full runs pending.

RUNNING: backend/results/benchmark/generative_v1/ — 25 epochs, p_mech_drop
0.2, lambda_rank 0.3, train_frac 0.5 (~16 min). Check train.log.

Next:
 1. Train ranker at scale + save checkpoint; re-run pipeline for the real
    score-lift / top-20 fraction numbers.
 2. Ranker ablations (seqonly vs conditioned vs invariant) on generated sets.
 3. Conformal calibrated-accept wired to the pipeline (reuse conformal_topk).
 4. Re-include ASO Atlas steric rows + eSkip-Finder scrape -> splice_switching
    mechanism becomes a TRAINED (not OOV) condition.

## DATA: splice_switching NOW TRAINED (2026-08-12)

- Re-cloned barneyhill/aso_atlas (temp path had been wiped). Raw pickle
  restored: 190,927 rows, 2,406 steric-blocking (splice-switching) rows.
- aso_atlas.py: added --keep_steric + mechanism column (rnase_h vs
  splice_switching). Steric rows kept (2,287 survive table>=10 + dedup);
  genes SCN1A(899)/GRN(829)/STMN2(312)/FN1(170)/MAPT(146)/C9ORF72(50) —
  NOT DMD-skewed (mitigates the eSkip-Finder confound concern).
- unified.py: modality now read from mechanism column.
- unified_benchmark.parquet REBUILT (3 mechanisms):
    rnase_h 159,215 | sirna 3,947 | splice_switching 2,287
  (siRBench CSVs were wiped from temp on 2026-08-12 and RE-ACQUIRED as
  committed raw sources; regeneration verified identical — see the
  2026-08-13 "THREE PENDING ITEMS CLOSED" section.)
- generator smoke on 3-mechanism data: mechanisms = [rnase_h, sirna,
  splice_switching]; splice_switching-conditioned generation valid
  (purity 1.0, GC 0.915).

CAVEAT: the first real training runs (generative_v1, ranker_v1) loaded the
OLD 2-modality parquet (launched before this rebuild). Treat them as the
seen-mechanism baseline; the paper runs must retrain on the 3-modality file.

## DATA REPRODUCIBILITY (2026-08-12)

Unified benchmark is now rebuildable from raw, committed sources:
- ASO Atlas clean parquet: backend/data/benchmark/aso_atlas_clean.parquet
- siRBench splits: backend/data/raw/siRBench/{siRBench_train,siRBench_test,
  siRBench_leftout}.csv, downloaded from HuggingFace dimostzim/siRBench-data
  (train 2776 + test 275 + leftout 896 = 3947 = exact count in unified file).
- Rebuild cmd: python -m backend.data_curation.unified --aso
  backend/data/benchmark/aso_atlas_clean.parquet --sirbench
  backend/data/raw/siRBench --output <outdir>
- Rebuild sanity: identical 165,449 rows, identical seq sets; only chemistry-
  fingerprint string token ORDER differs (parser artifact, same chemistry
  sets), chemistry_classes 234->233. The rebuilt file is now canonical.

## FIRST REAL PIPELINE NUMBERS (2026-08-12) — preliminary

Models: generator = 2-epoch SMOKE on 3-modality data (NOT the real model);
ranker = invariant, gene split, 15 epochs, pairs_per_exp=8 (REAL).

Pipeline on mechanism=splice_switching, chemistry=chem_oov, n=300:
- validity: purity 1.0, length 1.0, GC 0.98, homopolymer 1.0, novelty 1.0
- score_lift vs random: -0.02 (approx 0), gen_frac_in_top20 0.19
- conformal k=5: coverage 0.0, selected_size 41.9, n_groups 12

Read: the pipeline MEASURES transfer correctly; with a 2-epoch generator the
generated candidates are valid but rank-equivalent to random. splice_switching
has only ~12 experiments with >=5 rows -> conformal n small (report CI /
consider k=2).

Ranker_v2 (real): gene split topk_w 0.297 (matches GBM gene-split ceiling),
pearson_z 0.254, spearman ~0 (metric bug fixed: previously correlated argsort
positions, not true ranks).

## REAL GENERATOR v3 + REAL RANKER v2 — PIPELINE NUMBERS (2026-08-12)

Models: generator_v3 (20 epochs, 3-modality, free_bits 0.05, beta_warmup 5,
p_mech_drop 0.2, lambda_rank 0.3, train_frac 0.5; final kl_raw 2.41 = latent
informative, NOT collapsed) + ranker_v2 (invariant, gene split, 15 epochs).

Posterior collapse history: v1 (beta=0.1) -> KL 0.003; v2 (beta_warmup only)
-> KL 0.009 at epoch 4 (warmup alone insufficient); v3 (free_bits 0.05, per-
dim KL floor) -> raw KL stays >= 2.1 nats. FIXED.

Prior-sampled generation (n=1000, chemistry=chem_oov):
  mechanism        purity  novelty  score_lift   top20    conformal(k=5)
  rnase_h          1.0     1.0      +0.003       0.215    cov 0.16 (100 grp)
  sirna            1.0     1.0      -0.057       0.187    cov 0.0 (6 grp)
  splice_switching 1.0     1.0      -0.124       0.151    cov 0.0 (12 grp)
  mechanism_oov    1.0     1.0      -0.118       0.153    (no target groups)

Re-conditioned generation (decode top-30 rank rnase_h sequences under each
mechanism, n=1000): same negative result (lift -0.03..-0.14).

HONEST READ (important): generate->rank->accept pipeline WORKS mechanically
and generation is VALID and mechanism-distinct, but the ranker does NOT reward
generated candidates — score lift ~0 or negative. Generated (all-novel)
sequences sit slightly OUTSIDE the ranker's seen distribution and score below
random. Acceptance bottleneck = RANKER (gene-split topk 0.297 ~ chance; GBM
baseline 0.28-0.39) + prior-sampled CVAE candidates are average sequences,
not top-rank ones.

Conformal n is tiny for sirna (6) and splice_switching (12) -> report CI /
use k=2. rnase_h coverage 0.16 << 0.9 target confirms ranker scores are not
calibrated for top-5 selection.

Candidate next moves (pick before more compute):
  B) strengthen ranker (more epochs, more pairs/exp, features) -> cheapest
     bottleneck fix, target gene-split topk > 0.4
  C) rank-aware generation: sample z from posterior of top-ranked training
     sequences (conditional "top-of-manifold" sampling) so generated
     candidates live where the ranker has signal
  D) B + C together

## RANKER CEILING SETTLED (2026-08-12) — B does NOT work

Tried: ranker_v3 (invariant, gene split, 40 epochs, pairs_per_exp 16, d=192).
topk 0.269 / pearson 0.176 -> WORSE than v2 (0.297/0.254). The neural ranker
is not undertrained; it is at the data ceiling.

GBM ceiling on the SAME unified 3-modality data (new probe,
backend/experiments/benchmark/unified_gbm_baseline.py, gene split 75/25, k=10):
  lambdarank-rank  top-10 0.292 | pearson 0.289
  regress-rank     top-10 0.299 | pearson 0.307
  regress-raw      top-10 0.285 | pearson 0.274

CONCLUSION: cross-gene rank transfer on this data saturates at top-10 ~0.30 /
pearson ~0.30 for ANY model (GBM regress/lambdarank and neural alike). Chance
top-10 on median group size ~77 is ~0.13, so the signal is weak-but-real
(~2x chance). "Strengthen the ranker" is exhausted as a lever.

Pipeline re-run with ranker_v3: lifts +0.005..+0.027 (noise), coverage
0.05-0.08 vs 0.9 target. Same null acceptance as ranker_v2.

Next genuine levers:
  C) rank-aware generation (top-of-manifold sampling) -- the only lever left
     that can convert the weak-but-real pearson 0.3 signal into a lift, but
     effect will be small and noisy.
  E) Honest-paper framing: contribution = valid cross-mechanism conditional
     generation + a measured, reproducible finding that cross-gene rank
     transfer saturates at top-10 ~0.3 for all baselines (GBM included).
     No more training compute.

## OPTION C TRIED (2026-08-12) — ALSO NULL, FALL BACK TO E

Added rank-aware generation to generative_design.py: --z_topk k --sample_z
seeds latent z from the posterior (sampled, not just mu) of the k
highest-ranked training sequences of the target mechanism (mechanism-matched
seeds; falls back to largest modality for unseen mechanisms), then decodes
under the target mechanism/chemistry. Smoked, then ran full pipeline with
ranker_v2 (best gene-split: topk 0.297) n=1000:

  mechanism        purity  novelty  score_lift  top20   conformal(k=5)
  rnase_h          1.0     0.999    -0.007      0.213   cov 0.16 (100 grp)
  sirna            1.0     1.0      -0.063      0.171   cov 0.0 (6 grp)
  splice_switching 1.0     1.0      -0.133      0.143   cov 0.0 (12 grp)
  mechanism_oov    1.0     1.0      -0.131      0.143   (no groups)

Null is robust across ALL generation strategies tested (prior sampling,
recondition-from-top-rnase_h, top-of-manifold sampling). Generated candidates
are all-novel; the gene-split ranker scores them at-or-below random. The
systematic negative lift (-0.06..-0.13) suggests distribution shift: uniform-
ACGU random sequences match the ranker's seen distribution better than CVAE
outputs. SETTLED: acceptance bottleneck is real and is a DATA/measurement
ceiling (rank transfer saturates at top-10 ~0.30 for all models incl GBM),
not fixable by generation strategy. DECISION: fall back to option E (honest
paper framing). No further training compute.

## NEGATIVE LIFT DECOMPOSED (2026-08-12) — REMOVABLE GC ARTIFACT

Generated sequences are GC-shifted UP vs training: GC 0.551 / len 17.5 vs
training 0.469 / len 18.3 (random 0.501/17.3).

Within-experiment corr(GC, rank) in the data:
  rnase_h           +0.007  (GC-neutral)
  sirna             -0.323  (GC strongly NEGATIVE)
  splice_switching  -0.115  (GC negative)

=> generator's GC up-shift should push ranker scores DOWN precisely on the
mechanisms where GC negatively predicts rank (sirna, splice) and ~nothing on
rnase_h. Matches the measured lift direction (-0.06..-0.13 vs ~0).

CONFIRMED via GC-matched generation (restrict candidate GC to [0.40,0.55]):
  mechanism        lift prior   lift GC-matched
  rnase_h          -0.007       +0.078
  sirna            -0.063       +0.005
  splice_switching -0.133       +0.032
  mechanism_oov    -0.131       -0.009

Conclusion: the negative lift is a REMOVABLE generation artifact (GC
distribution shift). After GC matching, lifts are ~0 (residual = the rank
transfer ceiling top-10 ~0.30, which caps any positive signal). This gives
the honest paper a clean two-part story: (i) mechanism-conditioned generation
is valid; (ii) its activity-ranking value is bounded by a measured, model-
independent cross-gene ceiling, isolated from a documented and fixable
generation artifact (GC shift).

RUNNING: ranker mode ablation seqonly (backend/results/benchmark/
ranker_ablation_seqonly/), then conditioned, to settle the seqonly vs
conditioned vs invariant design claim for the methods section.

## RANKER MODE ABLATION + GC-MATCHED POSITIVE RESULT (2026-08-12)

Ranker mode ablation (gene split, 15 ep, pairs 8, d=128):
  seqonly     topk 0.327  pearson 0.333  spearman 0.325   <- BEST
  invariant   topk 0.297  pearson 0.254  (v2)
  GBM ceiling topk ~0.30  pearson ~0.31

Finding: the "invariance" GRL chem-classifier regularization HURTS gene-split
transfer (0.297 < 0.327). Plain sequence ranker exceeds the GBM ceiling.

Pipeline with BEST configuration = seqonly ranker + GC-matched generation
(candidates restricted to GC in [0.40,0.55]):
  mechanism        GC-matched lift  top20  (chance 0.2)
  rnase_h          +0.105           0.251
  sirna            +0.071           0.237
  splice_switching +0.056           0.228
  mechanism_oov    +0.009           0.205   (truly unseen -> ~0, honest)

FINAL STORY for the paper (honest, two-part, mechanism-explicit):
  (i) mechanism-conditioned generation is VALID (purity/novelty/len/GC), and
      re-conditioning + OOV-conditioning work;
  (ii) activity-ranking value is bounded by the measured cross-gene ceiling
      (top-10 ~0.30 all models); the apparent null decomposes into a REMOVABLE
      generation artifact (GC up-shift, quantified via within-experiment
      corr(GC,rank): -0.32 sirna / -0.12 splice) and the residual ceiling.
  After fixing the artifact and dropping the harmful invariance head, seen-
  mechanism candidates are ranked above random (lift +0.06..+0.11) while the
  truly unseen mechanism stays at chance -> an honest boundary condition.

RUNNING: conditioned ranker ablation (backend/results/benchmark/
ranker_ablation_conditioned/).

## FINAL: BEST CONFIGURATION (2026-08-12) — conditioned ranker + GC-matched

Ranker mode ablation COMPLETE (gene split, 15 ep, pairs 8, d=128):
  conditioned  topk 0.348  pearson 0.362  spearman 0.353   <- BEST
  seqonly      topk 0.327  pearson 0.333  spearman 0.325
  invariant    topk 0.297  pearson 0.254  (GRL invariance HURTS)
  GBM ceiling  topk ~0.30  pearson ~0.31

Pipeline, BEST config = conditioned ranker + GC-matched generation
(candidates GC in [0.40,0.55], n=1000, chem_oov):
  mechanism        lift   top20 (chance 0.2)
  rnase_h          +0.123  0.264
  sirna            +0.091  0.251
  splice_switching +0.041  0.223
  mechanism_oov    +0.055  0.232   <- even unseen mechanism now > chance

ALL FOUR mechanisms positive. Saved to backend/results/benchmark/
final_conditioned_gcmatched.json. This is the headline result table for the
paper. Caveats carried forward: effect small (rank ceiling), conformal
coverage still < target, generator GC bias corrected at selection time only.

## THREE PENDING ITEMS CLOSED (2026-08-13)

### 1) siRBench source CSVs re-acquired + regeneration verified

The CSVs were wiped from temp on 2026-08-12. Now restored as committed raw
sources at backend/data/raw/siRBench/{siRBench_train,siRBench_test,
siRBench_leftout}.csv (2776 + 275 + 896 = 3947 rows, HuggingFace
dimostzim/siRBench-data). Full regeneration verified end-to-end:
`python -m backend.data_curation.unified --aso backend/data/benchmark/
aso_atlas_clean.parquet --sirbench backend/data/raw/siRBench --output <dir>`
rebuilds the canonical unified_benchmark.parquet with IDENTICAL counts
(165,449 rows; rnase_h 159,215 / sirna 3,947 / splice_switching 2,287;
233 chem classes) and identical seq sets. No further acquisition needed.

### 2) Generator GC bias fixed AT THE SOURCE (not selection-time only)

Added GC-steered decoding to generative_design.py:
- GRUDecoder.sample(z, cond, lens, gc_target) reweights G/C vs A/U
  probabilities at every autoregressive position to hit a target GC given
  the length and GC decided so far — the decoder itself emits GC-matched
  sequences, no post-hoc candidate filtering.
- CLI: --gc_target <float> for an explicit target, or --gc_auto to steer
  each mechanism to its own training-data mean GC (OOV -> overall mean).
- Verified: generated GC now equals training GC (rnase_h 0.470 vs 0.468,
  sirna 0.518 vs 0.516, splice 0.486 vs 0.485, oov 0.471 vs 0.469) with
  validity/purity/novelty intact (all 1.0, gc_in_range 1.0).

New headline numbers with the source-level fix (conditioned ranker,
generative_v3, --gc_auto, n=1000, chem_oov, seed 0):

  mechanism        lift    top20   (chance 0.2)   genGC vs target
  rnase_h          +0.056   0.245                 0.470 vs 0.468
  sirna            +0.031   0.212                 0.518 vs 0.516
  splice_switching +0.030   0.215                 0.486 vs 0.485
  mechanism_oov    +0.009   0.203                 (truly unseen -> ~0)

Seed sweep (rnase_h, seeds 0-4): lift +0.056..+0.072, stable. The source-
level numbers are LOWER than the old selection-time band ([0.40,0.55],
+0.04..+0.12) — the filtering band selected the low-GC tail, which
over-stated the lift; the steering numbers are the honest ones.
Saved to backend/results/benchmark/final_gc_auto/ (per-mechanism
pipeline_result.json) and aggregated in
final_conditioned_gcmatched.json (now annotated "gc_steered_at_source").

### 3) Conformal: k=2 + confidence intervals

conformal_topk() now reports:
- coverage_ci: Wilson score 95% interval (valid for n=6-12),
- selected_size_mean_ci / selected_size_median_ci: percentile bootstrap
  (10k resamples, seed 0).

Pipeline re-run with --conformal_k 2 --conformal_alpha 0.1:

  mechanism        coverage   95% CI            n groups
  rnase_h          0.04       [0.02, 0.10]      100
  sirna            0.17       [0.03, 0.56]      6
  splice_switching 0.00       [0.00, 0.24]      12
  (mechanism_oov: no labeled target groups -> conformal N/A)

Even k=2 does not reach nominal 0.9 coverage; the CIs make clear the n is
too small for sirna/splice to claim anything except "below target". Story
stands: ranker's weak cross-gene signal (top-10 ~0.30) does not transfer to
calibrated top-k selection; reported openly.

Code touched: backend/experiments/benchmark/generative_design.py (GC-steered
sampling, gc_mean, --gc_target/--gc_auto), invariant_ranker.py (Wilson CI +
bootstrap CI in conformal_topk), backend/tests/test_benchmark.py (new; 11
tests total pass). Docs updated in paper_draft.md.

STILL OPEN (paper): references section of paper_draft.md; final LaTeX layout.
No further training compute required.
