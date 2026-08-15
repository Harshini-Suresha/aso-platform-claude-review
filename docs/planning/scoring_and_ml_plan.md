# Scoring system and machine learning — design plan

Merged platform (`gsdesign` rulebook spine + `aso-platform` ML work).
Prepared from a code review of `kakrat-bio/aso-platform-claude-review` at
commit `f26dec2`, plus Sessions 1–8 of the `gsdesign` specification.

Every quantitative claim below was verified against committed code, committed
results files, or a cited primary source. Nothing is recalled from memory.
Where a number could not be verified it is marked UNVERIFIED.

---

## 1. The claim

> Existing computational tools for oligonucleotide therapy all begin *after*
> the therapeutic mechanism has been chosen by a human. This system chooses
> it — from a gene and a variant, using learned predictions of transcript
> biology routed through an auditable rulebook — reports calibrated
> confidence, and declines to answer when the evidence does not support a
> single mechanism.

### 1.1 Prior art and where the gap is

| System | What it does | What it assumes |
|---|---|---|
| Kim et al., *Nature* 2023 — individualized splice-switching framework | whole-genome sequencing → SpliceAI + MaxEntScan → identify treatable individuals → ASO design | splice-switching is the mechanism |
| Envisagenics SpliceCore / SpliceLearn (PMID 38664594) | XGBoost on splicing-factor binding profiles → locate modulatory SSO binding sites | splice modulation is the mechanism |
| eSkip-Finder | exon-skipping efficacy prediction | exon skipping is the mechanism |
| OligoAI / ASO Atlas (bioRxiv 2025.10.29.685292) | gapmer potency prediction, ~188k datapoints | RNase-H gapmer is the mechanism |
| ASOptimizer | sequence + chemistry optimisation | mechanism already fixed |

**None of them arbitrate between mechanisms.** That decision is universally
left to a human. It is the decision the 27-mechanism rulebook exists to make,
and it is the contribution.

What is explicitly *not* claimed: better sequence-level efficacy prediction.
That field is crowded and our numbers do not beat it.

### 1.2 Why scaling helps rather than hurts

With one mechanism, arbitration is trivial — which is why nobody has
published on it. It becomes hard past five or six mechanisms and genuinely
hard across 27 mechanisms and 9 therapeutic goals, because mechanisms start
competing: a haploinsufficient gene may be addressable by blocking a poison
exon, blocking a uORF, blocking a repressive miRNA site, or activating the
promoter. Choosing between those *is* the scientific work.

Competing systems get harder to defend as they scale (more mechanisms = more
sequence models with less data each). This one gets easier to defend, because
the contribution only exists at scale.

---

## 2. Architecture

| Layer | Function | Learned? | Novel? |
|---|---|---|---|
| **L1 Biology evidence** | gene + variant → calibrated probabilities that specific transcript features exist | yes | components exist; the calibrated assembly does not |
| **L2 Mechanism arbitration** | feature probabilities → which mechanisms apply, with confidence + abstention | **no** — hand-written rulebook | **yes — this is the contribution** |
| **L3 Feasibility** | per surviving mechanism, can candidates actually be designed? | yes | novel as a *mechanism-level* signal |

**Invariant.** Machine learning supplies measurements; the rulebook renders
verdicts. A model that says "0.85 probability this exon is weakly recognised"
is wrong in a way a biologist can check. A model that says "use exon
inclusion" is wrong in a way nobody can audit.

---

## 3. Scoring system

### 3.1 Evidence feature vocabulary

L1 emits a fixed vocabulary. Each feature is a triple
`(probability, evidence_tier, provenance_tier)`.

| ID | Feature | Primary source | Fallback |
|---|---|---|---|
| F1 | Exon weakly recognised by spliceosome | SpliceAI | — |
| F2 | Variant creates cryptic splice site | SpliceAI + MaxEntScan | — |
| F3 | Deep-intronic pseudoexon activated | SpliceAI | — |
| F4 | Transcript contains NMD-inducing (poison) exon | **GENCODE `nonsense_mediated_decay` biotype annotation** | learned classifier |
| F5 | Repressive uORF in 5′ UTR, with strength | literature-validated uORF list | learned regressor |
| F6 | Overlapping natural antisense transcript | annotation lookup | — (no ML) |
| F7 | Repressive miRNA site in 3′ UTR | TargetScan context++ | — |
| F8 | Promoter methylated in target tissue | methylation atlas | — |
| F9 | Allele-distinguishing variant in transcript | dbSNP / ClinVar | — |
| F10 | Density of accessible, designable sites | ViennaRNA + hard gates | — |

Carried over from `gsdesign`, non-negotiable:

- An absent feature returns **ABSENT**, never probability zero.
- A *predicted* feature and a *literature-confirmed* feature never enter the
  score identically. This is what the provenance tier is for.

### 3.2 Applicability — bounded, not point-estimated

Hard eligibility gates run **first**. A gate failure **rejects** the
mechanism; it does not produce a low score (Session 4 §3).

For surviving mechanisms, applicability is reported as an **interval**, using
Fréchet–Hoeffding bounds, which hold for *any* dependence structure:

```
lower_k = max( 0, Σ p_f − (n − 1) )        over f ∈ required_k
upper_k = min( p_f )                       over f ∈ required_k
```

Forbidden features enter as `(1 − p_f)` terms on the same footing.

**No independence assumption is made anywhere.** See §6.3.

Where features come from the same underlying model (F1, F2, F3 all from
SpliceAI), they are treated as maximally dependent and combined with `min`.
Where they come from different models, the interval is reported in full and
its width is itself a reported signal.

### 3.3 Reliability cap

```
cap_k        = min over contributing features of tier_cap(provenance_tier_f)
confidence_k = MIN( applicability_k , cap_k )
```

Quality and reliability stay on separate axes, as in Session 4. A mechanism
may be 0.9 applicable and still capped at 0.75 because every supporting
feature is predicted rather than measured.

### 3.4 Feasibility — reported alongside, never multiplied in

L3 runs tiling + hard gates per eligible mechanism and returns:

- `Y_k` — count of candidates surviving gates
- median predicted efficacy from the sequence model

Output shape:

```
Exon inclusion       applicable 0.78–0.85 · capped 0.75 · 27 designable candidates
TANGO (poison exon)  applicable 0.05–0.12 · no poison exon detected
RNase H knockdown    REJECTED at gate — defect class incompatible
```

Three numbers, three meanings. Never collapsed into one.

### 3.5 Abstention

Mondrian (class-conditional) conformal prediction, calibrated **per
mechanism**, not globally. Global conformal over a 96%-RNase-H dataset gives
RNase-H guarantees wearing another label.

The system returns a *set* of mechanisms that cannot be ruled out at α = 0.1.
If the set exceeds a size threshold, or the RNA-FM embedding distance places
the gene outside the training distribution, it returns **ABSTAIN**.

This is the most publishable behaviour in the design and no competitor has it.

---

## 4. Machine learning inventory

### 4.1 Keep

| Model | Job | Evidence |
|---|---|---|
| Token cross-attention | siRNA efficacy → `Y` | 0.626 mean Pearson, 5-fold, Huesken — best model in the repo |
| LightGBM lambdarank | RNase-H efficacy → `Y` | top-10 0.292–0.299 vs a random-guess null of **0.174** |
| RNA-FM embeddings | features + out-of-distribution distance | 0.564 alone — strongest single signal anywhere in the repo |
| ViennaRNA | duplex ΔG for rules layer and hard gates | correct physics, correct job |
| primer3 | utility | no claims attached |

### 4.2 Add

| Model | Job | Data | Cost |
|---|---|---|---|
| SpliceAI | F1, F2, F3 | pretrained | install |
| **SpliceAI score calibration** | raw delta scores → probabilities | ClinVar + RNA-seq-validated splice events | low — see §6.1 |
| TargetScan context++ | F7 | pretrained | install |
| NMD-exon classifier | F4 fallback | GENCODE NMD-biotype transcripts + public UPF1-knockdown RNA-seq | medium |
| uORF repression regressor | F5 fallback | public ribosome profiling | medium |
| Mondrian conformal | abstention | own calibration split | low |

### 4.3 Retire, with evidence

| Component | Evidence |
|---|---|
| CVAE generator | `gen_frac_in_top20` = 0.245 / 0.212 / 0.215 / 0.203 against a null of **exactly 0.20 by construction**; comparator is uniform random ACGU strings |
| FusionNet, gated fusion | 0.552 vs RNA-FM alone at **0.564** — dominated by its own component |
| ViennaRNA *as an ML feature* | accessibility alone 0.119; adding to RNA-FM drops 0.564 → 0.537 |
| Neural ranker as headline | 0.269–0.297 vs LightGBM 0.292–0.299, at 14× training time (6,898 s vs 504 s) |

ViennaRNA is retired only from the ML feature block, not from the platform.

### 4.4 Full Huesken ablation, for the record

5-fold cross-validated Pearson, from `experiments/exp*/metrics.json`:

| experiment | features | mean | sd |
|---|---|---|---|
| exp03 | ViennaRNA accessibility only | 0.119 | 0.061 |
| exp01 | handcrafted (9-dim) only | 0.297 | 0.051 |
| exp04 | RNA-FM + accessibility | 0.537 | 0.039 |
| exp05 | RNA-FM + handcrafted | 0.551 | 0.025 |
| exp06 | FusionNet (all three) | 0.552 | 0.018 |
| exp02 | **RNA-FM alone** | **0.564** | 0.010 |
| exp10 | cross-attention | 0.584 | 0.024 |
| exp11/12 | **token cross-attention** | **0.619 / 0.626** | 0.026 |

---

## 5. Evaluation

**B1 — Mechanism recovery.** Built (`mechanism_recovery_benchmark.py`).
Ground truth: Sang et al., *BioDrugs* 2024;38(4):511–526, PMID 38914784,
Table 1. Current system scores top-1 0.909 / outright top-1 0.545 — but
controls show TG04 is a bijection from input to output and the gene is never
an input, so the present figure measures nothing. Becomes a real test once
the input is gene + variant. Design detail in §6.2.

**B2 — Rules-only vs rules+ML ablation.** Run B1 twice, L1 muted and live.
The delta is the headline: *this is what the learned layer contributes.*
Also ships as a user-facing toggle.

**B3 — Calibration stratified by evidence tier.** Reliability diagrams and
expected calibration error per tier. Converts the 75% in-silico ceiling from
an assertion into a measured property. Unpublished for this field.

**B4 — Abstention / coverage curve.** Report coverage vs accuracy, not a
point estimate: *"declines 42% of splice-switching cases; on the remainder
achieves X at 90% guaranteed coverage."* Converts the weakest results into a
contribution.

**B5 — Sequence-level ranking.** Blocked on §7 data fixes.

---

## 6. Risk mitigations

### 6.1 Risk: L1 is "SpliceAI plus a threshold"

**Three mitigations, in order of cost.**

**(a) Calibrate SpliceAI — cheap, and novel in itself.**
SpliceAI delta scores are neural network outputs in [0,1]. They are *not*
calibrated probabilities, yet they are routinely thresholded at 0.2 / 0.5 /
0.8 as though they were. Fitting a calibration map (isotonic or Platt) from
raw delta score to observed probability of a real splicing consequence —
against ClinVar-classified and RNA-seq-validated events, stratified by
consequence class — produces genuine probabilities.

This matters because §3.2 combines features *as probabilities*. Feeding
uncalibrated scores into that arithmetic is a category error. Calibrating
them is a small, defensible, publishable contribution and it converts L1 from
"we ran SpliceAI" into "we made SpliceAI's output usable in a probabilistic
decision system."

**(b) Annotation first, model as fallback — cheap, and it fits the
architecture exactly.**
F4 (poison exon) does not need a model for most genes: GENCODE already
labels `nonsense_mediated_decay` transcripts. F5 (uORF) has literature-
validated cases. So:

| Source | Provenance tier | Confidence cap |
|---|---|---|
| Annotated in GENCODE / published | CONFIRMED | high |
| Predicted by learned model | PREDICTED | capped |
| Neither | ABSENT | mechanism halts |

This is the `gsdesign` provenance system doing exactly what it was designed
for, and it means **the learned models are the upside, not the critical
path.** Phase 1 ships without them.

**(c) Build the two models — the upside.**
NMD-exon classification and uORF repression strength are the two genuinely
new predictors. With (a) and (b) in place they can slip without blocking the
system.

**Fallback position if neither model is built.** Drop the "novel predictors"
claim and position the paper purely as arbitration + calibration +
abstention, with L1 stated openly as off-the-shelf plus a calibration layer.
Weaker, still publishable, and honest. This is the floor, not the plan.

### 6.2 Risk: n = 11 is small

**Do not chase n first. Three design changes buy more than more rows would.**

**(a) Count honestly first — n is smaller than 11.**
The four DMD drugs (eteplirsen, golodirsen, viltolarsen, casimersen) are one
biological case, not four: same gene, same mechanism, different exon.
Inotersen and eplontersen are one case. Honest unique gene/mechanism pairs:
**7**. Report that number. Power is recovered by the designs below, not by
pretending 11 rows are independent.

**(b) Counterfactual scoring — ~5× the decisions from the same drugs.**
Each case is not one multiclass choice but N binary ones: for each candidate
mechanism, should it have been chosen or not? Eleven cases across 4–5
candidate mechanisms each gives ~50 binary decisions with a well-defined
null. Report AUC over those, alongside top-1.

**(c) Time-split evaluation — prospective by construction, and stronger
than more n.**
Freeze the rulebook and all literature to what was available before a cutoff
year, then test only on drugs approved after it. Casimersen (2021), tofersen
(2023) and eplontersen (2023) are all post-2020. A system that recovers a
mechanism it could not have known about is a far better result than one that
recovers 40 it was built around.

**(d) Extension to clinical-stage — later, and carefully.**
Target n ≈ 40. Source must be a published review or registry, every row
carrying a citation. **Never assembled from recall.** Standing project rule
(Session 5: eight of nine recalled PMIDs were wrong).

**(e) Sister benchmark — discontinued programmes.**
Harder to source, high value: does the system flag mechanisms that failed?
Optional, and only with a verifiable source.

### 6.3 Risk: the independence assumption is wrong

**Resolved by removing the assumption, not by registering it.**

The original plan multiplied feature probabilities, which requires
independence. F1, F2 and F3 all come from SpliceAI and are strongly
correlated; the assumption is known-false.

**Fréchet–Hoeffding bounds hold for any dependence structure:**

```
max( 0, Σ p_f − (n−1) )  ≤  P( all features present )  ≤  min( p_f )
```

Report the interval. Three consequences, all good:

1. No independence assumption is made anywhere, so there is nothing to be
   wrong about.
2. The interval **width is itself a useful signal** — a wide interval means
   the answer depends on dependence structure we have not measured, which is
   exactly the kind of uncertainty this system is supposed to surface.
3. It **tightens automatically** as the dependence structure is learned from
   data, without any architectural change.

Middle ground for ordering and display: features from the same source model
combine with `min` (treated as maximally dependent); features from different
models report the full interval.

Register in the calibration register: the source-model grouping (which
features are treated as maximally dependent) is a de-novo judgement and needs
a CAL-## entry and sign-off.

### 6.4 Risk: contested ground truth

**Pre-register the protocol before running, and score at three resolutions.**

**(a) Blind double annotation.** Two annotators independently code each case
from the primary source before any system output is seen. Disagreements are
**recorded, not resolved**. Report the inter-annotator agreement rate — it is
a property of the benchmark and reviewers will ask.

**(b) Three scoring resolutions.**

| Level | Credit | Rationale |
|---|---|---|
| Exact mechanism | A10 only | strictest |
| Mechanism family | A9 or A10 both count | for milasen, both readings yield near-identical designs — the clinical decision is the same |
| Therapeutic goal | any TG04 mechanism | tests goal routing separately from mechanism choice |

Report all three. A system that gets the goal right and the mechanism
slightly wrong has failed differently from one that routed to the wrong goal
entirely.

**(c) Input-sensitivity analysis, not adjudication.**
Tofersen's ambiguity is not in the ground truth — it is in the *input*. The
biology reads as gain-of-function (inviting `allele_specific`), but the drug
is not allele-selective. So run both inputs and report whether the answer
changes. An input-sensitivity result is more informative than picking one
input and hiding the choice.

**(d) Report the three headline numbers separately.**
Strict (contested = wrong) · lenient (contested = right if either reading
matches) · unambiguous-only subset. Never a single blended figure.

---

## 7. Blocking data fixes

Cheap, and everything downstream is uninterpretable until they land.

1. **`target_gene` holds the siRNA sequence for siRNA rows** — 3,947 "genes"
   for 3,947 rows, so `--split gene` is a plain random split for that
   modality. Every siRNA result labelled "gene split" is mislabelled.
   Huesken, Reynolds and Ui-Tei all carry real gene annotations.
2. **Splice-switching is 6 genes, all from patent tables** (`aso_atlas`,
   `US20250109396A1_table_*.xml`). A gene split leaves 1–2 test genes. Report
   effective n per modality, not row counts. The verified eSkip-Finder data
   is not in this benchmark — decide whether to add it.
3. **106 sequences appear in both `rnase_h` and `splice_switching`** —
   leakage along exactly the axis the transfer claim tests.
4. **Conformal results are stale.** Code is fixed (verified numerically:
   0.887 empirical coverage at α = 0.1) but `final_gc_auto/*/
   pipeline_result.json` still reports 0.04 / 0.167 / 0.0 from before the
   fix. Rerun. Also `n_groups` = 6 (siRNA) and 12 (splice) is below where a
   finite-sample guarantee exists.
5. **No modality rebalancing anywhere.** Stratified retrain — cheap, and it
   removes the mundane explanation for the cross-mechanism transfer result.
6. **`DEFECT_TYPES` has no term for "reduce a normal protein for benefit."**
   This is why mipomersen fails B1 (ranks 2nd behind A15). It is the largest
   class of approved ASO. Fixing it changes ground truth for 3 of 11 rows.
7. **`admet_service.py` line 276** reports
   `varianceExplained: {axis1: 0.60, axis2: 0.25}` for a procedure that
   performs no variance decomposition. Delete before external release.
8. **Compatibility tables duplicate `rule.json`.** `DEFECT_COMPATIBILITY` and
   friends restate `suitableVariantTypes` / `molecularDefect`. Two sources of
   truth that can silently diverge; the rulebooks are better curated.
9. **TG01 and TG04 do not accept `gene_features`** although TG02 does. Same
   argument applies to all three.

---

## 8. Build order

| Phase | Scope | Duration | Exit test |
|---|---|---|---|
| **0 — unblock** | §7 items 1–9; rerun B1 on corrected ground truth | ~1 week | clean baseline number exists |
| **1 — one goal end to end** | SpliceAI + calibration (§6.1a); F1–F3 into TG04; interval arithmetic; reliability cap | 2–3 weeks | nusinersen + 4 DMD drugs recovered from gene+variant alone, no defect dropdown |
| **2 — arbitration becomes real** | annotation-first F4–F9 (§6.1b); extend to TG01 and TG02 so mechanisms compete across goals; fix the goal-routing gap that hides nusinersen's answer | 3–4 weeks | a gene routes to the right goal without being told |
| **3 — calibration and abstention** | Mondrian conformal per mechanism; OOD via RNA-FM distance; B3 and B4 | 2–3 weeks | coverage curve reportable |
| **4 — feasibility coupling** | L3 wired: LightGBM (RNase-H), token cross-attention (siRNA); yield per mechanism | 2 weeks | three-number output shipping |
| **5 — learned L1 (upside)** | NMD-exon classifier, uORF regressor (§6.1c) | open | PREDICTED-tier features live |
| **6 — product surface** | rules-only toggle; tiering per §9 | open | — |

Phases 1–4 ship a complete, defensible system **without** Phase 5.

---

## 9. Product tiering

**Split on cost and workflow. Never on quality of the answer.**

Selling confidence in a therapeutic design context — "pay more for a better
answer about which mechanism to develop" — reads badly to a scientist, a
reviewer, and a regulator. The free/paid line must not fall along the axis of
how right the answer is.

**Free** — one gene at a time; full mechanism arbitration *including* the
learned biology layer; ranked mechanisms with confidence and abstention; top
handful of candidates; everything traceable to a rule and a citation.

**Paid** — batch runs across many genes; transcriptome-wide off-target
screening; full chemistry recommendation and audit dossier; human approval
checkpoint with decision record; synthesis-ready export; the Session 8
wet-lab feedback loop; API access; saved projects and version history.

The feedback loop is the strongest paid feature and has nothing to do with
model access — a customer who feeds results back gets a system that improves
on their own data. Sticky, and uncopiable.

**Rules-only toggle (free).** Not a second scoring system — the same system
with L1 muted. The difference between the two views is directly
interpretable: *this is how much the learned layer contributed.* Same
mechanism as B2, exposed to users.

Note on multiple scorers: two or three rule-based scorers derived from the
same rulebooks are not independent, so their agreement is guaranteed and
meaningless. Genuine independence exists only between the rulebook (what the
literature says) and the biology layer (what the sequence says). One score,
one independent second opinion, one agreement flag.

---

## 10. Open sign-off items

Carried from `gsdesign`, still open, now blocking:

- **CAL-23 differentiator method** — blocks weight tuning.
- **GAP-15 full hepatotoxicity classifier** — interim only (Burdick motifs).
- **Off-target backend** — SC-SP has no predicted value until built.
- **Dieckmann 2018 (PMID 29499955) as CAL-14 anchor** — requires a re-tiering
  decision, not a calibration.
- **Sugimoto 1995 nearest-neighbour table** — superseded by Banerjee 2020/2021
  (PMIDs 32663294, 34520551); confirm no stale references remain.

New, from this plan:

- **CAL-NEW-01** — source-model dependence grouping in §3.2 (which features
  are treated as maximally dependent) is a de-novo judgement.
- **CAL-NEW-02** — SpliceAI calibration map: method, reference dataset,
  consequence-class stratification.
- **CAL-NEW-03** — abstention set-size threshold and OOD distance cutoff.
- **CAL-NEW-04** — the new `DEFECT_TYPES` term for "reduce a normal protein
  for therapeutic benefit," and its compatibility set.
