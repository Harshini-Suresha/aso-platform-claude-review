# REVIEW PROMPT — run this against the repo snapshot in Claude Science

CONTEXT: I'm building an RNA Therapeutics AI Platform (KoshKey Sciences) and
targeting ICLR 2027 main track with a paper on mechanism-conditioned generative
design for therapeutic oligonucleotides. Attached: PROJECT_HANDOFF.md (full
project state, read this first) and paper_draft.md (current draft,
"honest-results version").

THE ONE RULE THAT GOVERNS EVERYTHING IN THIS PROJECT: no fabricated data, ever.
Every number must be Computed (deterministic), Learned (trained model, reported
accuracy), Real Precedent (cited drug/trial), or explicitly labeled Heuristic.
Hard eligibility gates never blend arithmetically with soft scores. This
project has repeatedly had fabricated/invented numbers slip in from other AI
tools and had to be caught and removed — treat any unexplained constant with
default suspicion, not default trust, and flag (do not "fix") any number you
cannot trace to one of the four categories above.

WHAT I NEED FROM YOU:

1. VERIFY citations I haven't independently confirmed yet:
   - Reference [13] ASO-RASAR (J. Chem. Inf. Model. 2026, doi:10.1021/acs.jcim.6c01314)
     — not yet checked.
   - Cross-check reference [2] siRBench — I confirmed this is real (bioRxiv,
     posted May 14 2026, "Benchmarking siRNA Prediction: The Role of
     Representation and Validation Strategies," AUC 0.845 leakage-free,
     HuggingFace dimostzim/siRBench-data) — but confirm the specific numbers
     cited in the draft (3,947 siRNA rows) actually trace to this source.
   - Every other reference in the list — spot-check at least the ones not
     already flagged as verified in PROJECT_HANDOFF.md section 5.

2. RESOLVE the inconsistencies I found:
   a. CORAL: I confirmed it is REAL (bioRxiv, April 2026, "Cross-Attention Over
      RNA And Protein Sequences Enables Generalizable Interaction Prediction,"
      DNABERT2+ESM-2 cross-attention) — but it is an *interaction prediction*
      method, not generative design. The draft's ref [12] was replaced with
      RaptGen; make sure the stated reason is "wrong category," not
      "unverifiable," and confirm whether CORAL still belongs in related work
      as a prediction-method comparison.
   b. The conditioned ranker appears at top-10 = 0.348 in both Table 1 and the
      §4.4 ablation, and §4.2's stated range already covers it (0.285–0.348).
      The remaining issue is the abstract and §4.2 lead-in saying "top-10 ≈
      0.30" — confirm this summary language understates Table 1 and fix the
      wording. Do NOT rerun experiments for this; it's a text issue.
   c. The draft reports 2,287 splice_switching rows. eSkip-Finder (PMC8265194,
      ref [8]) is documented elsewhere in this project as 426 PMO + 228 2'OMe =
      654 real measurements. §3.2 already explains the 2,287 are the ASO Atlas
      steric rows (2,406 raw → 2,287 after ≥10-row + dedup), NOT eSkip-Finder —
      but verify the "2,406 raw" figure against backend/data_curation/
      aso_atlas.py and the committed data, and confirm the text can't be read
      as conflating the two numbers.
   d. Provenance gap you should check: the ASO Atlas clean parquet has 172,580
      rnase_h rows, but the unified benchmark has 159,215. The ~13k drop comes
      from backend/data_curation/unified.py (alphabet filter, experiment-group
      ≥10, and (seq, modality) dedup keeping the largest group). Confirm those
      drops are legitimate and that "keep largest group" does not bias toward
      the largest patent tables.

3. ASSESS the ML architecture and tell me plainly if you'd change anything:
   - Is the CVAE + conditioning-dropout + free-bits approach still the right
     call given the compute/timeline reality and what the actual results show
     (a hard cross-gene ranking ceiling, GC-artifact-driven false negatives)?
   - Is "mechanism-conditioned cross-modality transfer, tested honestly
     including a null result for the unseen mechanism" still the strongest
     defensible novelty claim, or has something changed given the newly
     verified prior art (CORAL, CrossLLM-Mamba, Hill et al./OligoAI trained
     on 188k+ real gapmer datapoints)?
   - Is the "11 passed" test count an adequate signal of coverage for a
     pipeline this complex (data curation + CVAE + ranker + conformal
     acceptance)? IMPORTANT: running `pytest backend/tests` currently FAILS at
     collection — test_dataset.py and test_main.py error out (starlette.testclient
     requires httpx, not installed). The 11 passing tests are only in the four
     non-API test files. Verify this and tell me whether to fix the env or fix
     the claim.

4. Give me a concrete revision plan, ranked by what actually threatens
   the paper's chances vs. what's just polish — I have very limited time
   before the deadline and need to spend it on what matters.

Do not soften findings to be encouraging — I need the accurate picture, not
reassurance. If something in the draft is weaker than it's presented, say so
directly, the same way this has been reviewed throughout the project so far.

ADDITIONAL CONTEXT AND REQUESTS:

5. ALREADY-VERIFIED FACTS — use these, don't re-derive or silently contradict
   them without telling me why:
   - siRBench (ref [2]) is real: bioRxiv, posted May 14 2026, "Benchmarking
     siRNA Prediction: The Role of Representation and Validation Strategies,"
     reports AUC 0.845 on leakage-free validation, explicitly built to fix
     data leakage in prior siRNA CV protocols — directly relevant context
     since leakage is exactly what we need to rule out in our own gene-level
     split too.
   - Hill et al. / ASO Atlas / OligoAI (ref [1]) is real and is the single
     most important prior-art baseline for the rnase_h/gapmer arm — trained
     on 188,000+ real patent-literature gapmer datapoints. Confirm our
     159,215-row rnase_h subset's relationship to their full 188k (dedup?
     filtering criteria?) and whether OligoAI itself should be a run baseline,
     not just a citation.
   - CrossLLM-Mamba is real, very recent, already critiques cross-attention's
     quadratic complexity as a limitation, and already uses RiNALMo as a
     frozen backbone — if RiNALMo is used anywhere in this project, this
     paper must be directly addressed in related work.
   - Real approved-drug delivery precedent already confirmed in this project:
     nusinersen (CNS/intrathecal), inotersen/patisiran/givosiran (liver),
     eteplirsen (local/intramuscular), TD101 (skin, Phase 1b trial only, NOT
     approved — Leachman et al. 2010). Don't re-verify these; see
     PROJECT_HANDOFF.md section 5 for the tiering logic if the paper discusses
     delivery context anywhere.

6. CROSS-AGENT DRIFT CHECK — this project has a documented, repeated failure
   pattern (see PROJECT_HANDOFF.md section 7): different AI tools working on
   the same codebase at different times reintroducing fixed problems, or
   independently reimplementing logic that already exists elsewhere and
   drifting out of sync (e.g., mechanism eligibility rules almost got
   duplicated between the ranking service and the design service). Explicitly
   check whether the paper's benchmark code and the product's backend services
   have duplicated any logic that could now silently disagree — start with the
   specific suspects listed in PROJECT_HANDOFF.md section 7 (GC/Tm
   computations in backend/services/* vs the GC steering in
   backend/experiments/benchmark/generative_design.py).

7. DON'T TRUST THE SUMMARY, CHECK THE ACTUAL CODE/LOGS — the reproducibility
   claims (fixed seeds, "11 passed" tests, exact reported numbers) should be
   verified against the committed code and the run artifacts in
   backend/results/benchmark/, not accepted because the draft states them
   precisely. Precision of a number is not evidence it's correct — this
   project has been burned by confident-looking numbers before.

8. A SPECIFIC SCIENTIFIC QUESTION I want addressed, not just polish: the
   dataset is 159,215 rnase_h / 3,947 sirna / 2,287 splice_switching —
   rnase_h is ~96% of the data. Is the near-chance performance on sirna/
   splice_switching (and the true-zero on the unseen mechanism) actually
   evidence that "cross-mechanism transfer is hard," or could it just as
   well be a severe class-imbalance artifact — i.e., would a rebalanced or
   upweighted training scheme change these numbers materially? The rankers
   train in ~5 min on CPU, so a rebalanced/upweighted-pairs experiment is
   cheap if one is needed. If this alternative explanation isn't already
   ruled out or explicitly discussed in Limitations, that's a real gap a
   reviewer will raise, and I'd rather know now.

9. Check whether GENERATION (the thing the title and abstract center on) is
   actually given proportionate empirical weight in Results — Section 4.1
   covers generation validity briefly, but 4.2–4.4 are entirely about the
   ranking/acceptance side. If a reviewer reads this as "a ranking paper
   wearing a generation title," that's a framing problem worth fixing before
   submission, not after.

10. ML PIPELINE — design the ideal production pipeline for the PLATFORM and
    tell me exactly how to integrate it with what already exists, or whether
    to build something new. Here is the real current state, mapped from the
    code:
    - Trained models that exist: backend/models/ — BaselineMLP, fusion,
      gated_fusion, cross_attention, token_cross_attention (v1/v2), trained
      via backend/train.py / evaluate.py on OligoFormer/Hu.csv with RNA-FM
      embeddings (backend/config/config.yaml: 2×640-d RNA-FM + 11
      accessibility features, MSE regression, seed 42, checkpoints in
      backend/checkpoints/).
    - The paper pipeline: backend/experiments/benchmark/ — mechanism-
      conditioned CVAE + conditioning dropout + GC steering, three ranker
      modes (seqonly/conditioned/invariant) + GBM baselines + split-conformal
      top-k (gene split, seed 0), results in backend/results/benchmark/.
    - The product side: backend/engines/*.ts (CandidateGenerationEngine,
      RankingEngine, ValidationEngine, OptimizationEngine, MechanismEngine,
      TargetDiscoveryEngine, TherapeuticGoalEngine, MolecularDefectEngine) —
      several are stubs or heuristic, backend/inference/ is EMPTY (nothing is
      served), and the paper's §1 states the product has "no quantitative
      model of activity that feeds the choices back".
    Given that, answer: (a) what is the right end-to-end production ML
    pipeline for this platform (retrieval → mechanism selection → candidate
    generation → ranking → acceptance/validation → feedback loop); (b) build
    it on the paper's generate→rank→conformal pipeline, or a different
    architecture — and why; (c) a concrete integration plan against the ACTUAL
    files — which modules to create/refactor, where models get served
    (FastAPI backend/api/* + services), how to reuse the existing RNA-FM
    embedding cache and the unified benchmark, and how the TypeScript engines
    call it; (d) what to prioritize given CPU/MPS-only compute and the ICLR
    deadline. If the right answer is "don't integrate yet, the paper comes
    first," say so plainly. Name real files; no hand-waving.

11. DELIVERY OF CHANGES — implement every accepted fix by editing the actual
    files in this repo. Commit your changes to a branch named `claude-review`
    (never touch `main`), push that branch, and report the branch URL plus a
    per-change log: file, line(s), before → after, reason, and — for any new
    number you introduce — which of the four categories it falls under
    (Computed / Learned / Real Precedent / Heuristic). If a change requires a
    number you cannot compute from the committed code/data or trace to a real
    precedent, say so and leave it out rather than inventing it. If a change
    requires re-running an experiment, note the exact command; do not report
    results you did not actually run.

Give me a triaged CUT LIST too, not just a fix list — given the real ICLR 2027
deadlines (mandatory informative abstract Sep 18, 2026 AOE; full paper Sep 25,
2026 AOE), I need to know explicitly what to NOT spend time on, since scope
creep has been the recurring failure mode in this project so far.
