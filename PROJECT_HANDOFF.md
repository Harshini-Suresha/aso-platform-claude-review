# PROJECT_HANDOFF — RNA Therapeutics AI Platform (KoshKey Sciences)

Status snapshot for handing this repository to an external reviewer model.
Companion files: `docs/paper_draft.md` (the manuscript) and
`CLAUDE_REVIEW_PROMPT.md` (the review brief to run against this repo).
Everything here is either verified against the committed code/data in this
snapshot or labeled as policy/context supplied by the authors.

---

## 1. What this is

A platform-first antisense oligonucleotide (ASO) design system plus an ICLR 2027
paper about the machine-learning core:

- **Platform**: biological information retrieval engine (Ensembl, NCBI, UniProt,
  ClinVar, GTEx, Reactome, STRING, PubMed connectors) → rulebook engine (26
  molecular mechanisms A1–A26 across 9 therapeutic goals) → design engines that
  emit candidate sequences with heuristic GC/Tm/ΔG estimates.
- **Paper**: *Mechanism-Conditioned Generative Design Across Heterogeneous
  RNA-Targeting Modalities* — mechanism-conditioned CVAE over a unified
  three-modality benchmark, with a generate → rank → conformal-accept pipeline,
  reported honestly including negative results. Written platform-first; the ML
  contribution is one mechanism-conditioned model over three modalities.

Structure: `backend/` (FastAPI + ML experiments), `frontend/` (Next.js),
`shared/`, `docs/` (paper draft, figures, therapeutic-goal rulebooks),
`paper/` (LaTeX source), `OligoFormer/` (gitlink to upstream lulab/OligoFormer,
not vendored here).

---

## 2. The one rule that governs everything

**No fabricated data. Ever.**

Every number in this project must fall into exactly one of four categories:

1. **Computed** — deterministic from committed data/code (state the function).
2. **Learned** — produced by a trained model, with reported accuracy.
3. **Real precedent** — a cited drug/trial/publication.
4. **Heuristic** — explicitly labeled as such.

Additional hard rule: **hard eligibility gates never blend arithmetically with
soft scores.** Any unexplained constant should be treated with default suspicion,
not default trust. This project has repeatedly had fabricated/invented numbers
slip in from other AI tools; they had to be caught and removed by hand. The
specific incident log was not preserved in this repository, so the rule itself
is the guard: if a number cannot be traced to one of the four categories above,
it must be flagged and removed, not "fixed".

---

## 3. Benchmark and data (all counts verified against committed artifacts)

`backend/data/benchmark/unified_benchmark_stats.json`:

| metric | value |
|---|---|
| rows | 165,449 |
| rnase_h | 159,215 |
| sirna | 3,947 |
| splice_switching | 2,287 |
| experiments | 1,974 |
| chemistry classes | 233 |
| target genes | 4,289 |
| seq length range | 12–28 nt |
| corr(rank, raw label) | 0.958 |

Provenance:

- **RNase H gapmers + splice-switching**: ASO Atlas, Hill et al. 2025 (ref [1]
  in the draft), patent-derived. Raw rows 190,927 → cleaned 174,867
  (rnase_h 172,580, splice_switching 2,287) per `backend/data/benchmark/
  aso_atlas_stats.json`. The splice-switching rows are the ASO Atlas steric rows
  (2,406 raw → 2,287 after ≥10-row + dedup) — **not** eSkip-Finder (that is
  related-work only, ~654 entries). Draft §3.2 covers this; verify the "2,406
  raw" figure against `backend/data_curation/aso_atlas.py` + raw data.
- **siRNA**: siRBench, Karmakar et al. 2026 (ref [2]), train/test/leftout
  splits, efficiency rescaled to 0–100; experiment group = (source, cell_line).
- **Unified filtering** (`backend/data_curation/unified.py`): alphabet-only
  (A/C/G/U), experiment groups ≥10 rows, dedup on (seq, modality) keeping the
  largest group. Note: rnase_h in the unified benchmark is 159,215 vs 172,580
  cleaned — ~13k rows dropped by exactly those three filters. Confirm this drop
  is legitimate and that "keep largest group" does not bias toward the largest
  patent tables.

Raw sources are committed under `backend/data/raw/siRBench/*.csv` and
`backend/data/benchmark/*.parquet` (ASO Atlas clean + unified benchmark). A note
in the draft flags the siRBench mirror as third-party-hosted, not confirmed as
the authors' official release.

---

## 4. Paper state

- `docs/paper_draft.md` — draft 0.2, "honest-results version". Every headline
  number claims to be measured on 2026-08-12 runs, reproducible from committed
  code + data.
- `paper/` — LaTeX source (main.tex, references.bib) + compiled main.pdf.
- `docs/figures/` — all six figures generated from committed artifacts by
  `generate_figures.py` (values cannot drift from text).
- Key results: cross-gene rank-transfer ceiling top-10 ≈ 0.30 / Pearson ≈ 0.30
  across all model classes (GBM LambdaRank, GBM regression raw + rank targets,
  neural seqonly/conditioned); the apparent null on generated candidates
  decomposes into a removable GC-drift artifact (fixed at the decoder via GC
  steering) plus the residual ceiling; the unseen mechanism stays at chance
  (+0.009, top-20 0.203); invariance regularization (GRL head) hurts transfer;
  conformal top-k coverage falls far below nominal and is reported openly with
  Wilson CIs.

### Deadlines (confirmed from ICLR 2027 Call for Papers)

- **Abstract deadline: Sep 18, 2026 AOE** (mandatory, must be informative; no
  authors can be added after this date).
- **Full paper deadline: Sep 25, 2026 AOE.**
- (Not Sep 24 — plan against the abstract date; it is the real constraint.)

---

## 5. Verified prior art and precedent (do not re-derive)

- **siRBench** (ref [2]) — real: bioRxiv, posted May 14 2026, "Benchmarking
  siRNA Prediction: The Role of Representation and Validation Strategies",
  AUC 0.845 on leakage-free validation; explicitly built to fix data leakage in
  prior siRNA CV protocols. Directly relevant: the same leakage risk applies to
  the gene-level split here.
- **Hill et al. / ASO Atlas / OligoAI** (ref [1]) — real; trained on 188,000+
  real patent-literature gapmer datapoints. The relationship of the paper's
  159,215-row rnase_h subset to their 188k (dedup? filtering criteria?) should
  be stated explicitly; consider whether OligoAI should be a run baseline, not
  just a citation.
- **CrossLLM-Mamba** (ref [9]) — real, recent; critiques cross-attention's
  quadratic complexity; uses RiNALMo as a frozen backbone. If RiNALMo appears
  anywhere in this project, this must be addressed in related work.
- **CORAL** — real (bioRxiv, April 2026, "Cross-Attention Over RNA And Protein
  Sequences Enables Generalizable Interaction Prediction", DNABERT2+ESM-2
  cross-attention) but is an *interaction prediction* method, not generative
  design. Draft ref [12] was replaced with RaptGen; the reason for excluding
  CORAL should be stated as wrong-category, not "unverifiable".
- **Delivery precedent** (drug-level, real): nusinersen (CNS / intrathecal),
  inotersen / patisiran / givosiran (liver), eteplirsen (local / intramuscular),
  TD101 (skin; Phase 1b trial only, NOT approved — Leachman et al. 2010).

---

## 6. Known issues the reviewer must not miss

1. **Reproducibility test claim is currently false as written.** The draft says
   "`pytest backend/tests` (11 passed)". In this snapshot, that exact command
   fails at collection: `test_dataset.py` and `test_main.py` error out
   (`starlette.testclient` requires `httpx`, not installed). 11 tests pass only
   when running the four non-API test files
   (`test_benchmark`, `test_features`, `test_gene_service`, `test_token_model`).
   Either add `httpx` to `backend/requirements.txt` and verify the full suite, or
   correct the claim.
2. **Abstract understates Table 1.** The abstract and §4.2 lead-in say
   "top-10 ≈ 0.30", but Table 1's neural *conditioned* ranker is 0.348
   (top-10) / 0.362 (Pearson). §4.2's stated range already includes it
   (0.285–0.348); the ≈0.30 summary is the inconsistency to fix. This is a
   wording fix, not new experiments.
3. **Class imbalance is not yet explicitly ruled out as an alternative
   explanation** for the sirna / splice_switching / unseen-mechanism results:
   rnase_h is ~96% of the data. A rebalanced/upweighted ranking scheme has not
   been run. This is the most likely reviewer objection; the rankers train in
   ~5 min CPU, so an upweighted-pairs experiment is cheap.
4. **Generation is under-weighted in Results.** §4.1 covers generation validity
   briefly; §4.2–4.4 are all ranking/conformal. A reviewer can read this as "a
   ranking paper wearing a generation title". Framing risk.
5. **rnase_h provenance gap** (see §3): 159,215 vs 172,580.
6. **OligoFormer** is a gitlink to upstream; it is not vendored in this
   snapshot.
7. **Large files intentionally excluded from this snapshot**: RNA-FM pretrained
   weights (1.1GB), hu token/sequence embedding caches (438MB / 12MB). They are
   regenerable and would exceed upload limits; the draft's Reproducibility
   section does not depend on them for the benchmark numbers.

---

## 7. Cross-agent drift warning

This project has a documented, repeated failure mode: different AI tools working
on the same codebase at different times reintroduce fixed problems or duplicate
existing logic and drift out of sync. Check, specifically:

- **GC content computation** exists in multiple places: `backend/services/
  admet_service.py`, `backend/services/upload_service.py`,
  `backend/services/enrichment_service.py` (heuristic, product-side) vs the
  GC-steering logic in `backend/experiments/benchmark/generative_design.py`
  (training-mean steering, paper-side). Confirm they do not silently disagree.
- **Mechanism eligibility rules** — a past near-miss duplicated eligibility
  logic between the ranking service and the design service; confirm no such
  duplication now disagrees (rulebook `backend/rulebooks/`, services).
- The paper's benchmark code and the product's backend services should be
  checked for duplicated logic that could diverge (e.g., chemistry fingerprints,
  T→U normalization in `backend/data_curation/unified.py`).

---

## 8. What is NOT in this snapshot (intentionally)

- `.git` history, `node_modules`, `.next`, venvs, `.kilo` tool state.
- `backend/pretrained/`, `backend/data/hu_*.pt`, `backend/checkpoints/*.pth`.
- Any `.env` / secrets (only `.env.example` templates are included).

The full private repo (with history and the above artifacts) is on GitHub:
`Harshini-Suresha/rna-therapeutics-ai`.
