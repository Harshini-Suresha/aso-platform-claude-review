# Therapeutic goal and mechanism scope — implementation plan (v3)

Companion to `scoring_and_ml_plan.md` and `model_training_specs.md`.

**Supersedes v1 and v2.** This version contains decisions, not options.
Where an earlier version presented a choice, the choice has been made and the
reasoning recorded. Nothing below is left for the reader to resolve.

Verified against `backend/rulebooks/` and `backend/services/mechanism_service.py`
at commit `f26dec2` plus the Phase 0 branch.

### Version history

| Version | Position | Why it changed |
|---|---|---|
| v1 | Remove TG08; demote TG09 to lookup | Confused *what this platform can design* with *what a scientist is choosing between* |
| v2 | Full Family P + Family B, scored | Correct on coverage, but emitted probabilities for modalities with no approved therapy to validate against |
| **v3** | **Modality flag: P2 + P6 + B1 only, qualitative, unscored** | **Fixes the TG02 correctness bug without emitting an unverifiable number** |

---

## 0. The decision

**A24, A25 and A26 are represented as a qualitative modality flag, not as
scored mechanisms.**

### The problem this solves

For a haploinsufficient gene with no poison exon, no uORF, no natural
antisense transcript and no repressive miRNA site, every transcript-acting
upregulation mechanism scores near zero. Without any representation of
protein replacement, TG02 returns either "no suitable mechanism" or the
least-bad ASO at 0.15 applicability — and the user never learns that
replacement is the obvious move.

More seriously: **without a replacement arm to compare against, TG02
recommends transcript-boosting unconditionally**, including for genes where
no boostable transcript exists. That is a wrong answer produced confidently,
in the goal being built first. This is a correctness bug, not a coverage gap.

### Why not score it

There is **no approved mRNA protein replacement therapy and no approved
circRNA therapy**. So a stated applicability of 0.81 for A24 cannot be checked
against any case in the world. The mechanism-recovery benchmark cannot score
it; the calibration work cannot calibrate it. In a project whose governing
rule is that every number traces to a rule ID, a citation or a calibration
parameter, an unverifiable probability is a worse defect than the missing
coverage it was meant to fix.

### The resolution

Implement the two features that carry the correctness fix. Emit text, not a
number.

```
No transcript-acting upregulation mechanism is viable for this gene:
no poison exon, no repressive uORF, no overlapping antisense transcript,
no repressive miRNA site detected.

Protein replacement may be worth considering — endogenous transcript is
low and no dominant-negative allele is recorded.

This platform does not evaluate or design replacement therapies.
```

No probability. Nothing to validate. No cross-family ranking problem, because
there is nothing to rank. Two annotation lookups instead of ten features.

### The principle behind it

The contribution of this platform is not breadth of coverage — breadth is
cheap and nobody grades it. It is **a system that knows the limits of its own
recommendation**. The flag adds coverage without softening any claim. A scored
replacement arm would look more impressive and would not survive the first
question a reviewer asks: *how do you know 0.81 is right?*

**Recorded promotion condition.** If an approved replacement therapy appears
in a validatable indication class — protein replacement, not vaccination —
revisit and promote the flag to a scored mechanism with a full feature family.
Until then it stays a signpost.

---

## 1. Feature families

### Family T — transcript-acting (the platform's scored vocabulary)

Applies to A1–A23, A27, A28.

| ID | Feature | Serves | Source | Status |
|---|---|---|---|---|
| F1 | Exon weakly recognised by spliceosome | A8, A3 | SpliceAI | build |
| F2 | Variant creates cryptic splice site | A10 | SpliceAI + MaxEntScan | build |
| F3 | Deep-intronic pseudoexon activated | A9 | SpliceAI | build |
| F4 | NMD-inducing (poison) exon present | A3 | GENCODE biotype → classifier | build |
| F5 | Repressive uORF, with strength | A5 | literature list → regressor | build |
| F6 | Overlapping natural antisense transcript | A4 | annotation lookup | build |
| F7 | Repressive miRNA site in 3′ UTR | A6 | TargetScan context++ | build |
| F8 | Promoter methylation / accessibility | A23, A15 | methylation atlas | build |
| F9 | Allele-distinguishing variant present | A1/A2 allele-selective | dbSNP / ClinVar | build |
| F10a | Accessible site density, transcript-wide | A1 | ViennaRNA + gates | build |
| F10b | Accessible site density, 5′ UTR / start codon | A2 | ViennaRNA + gates | build |
| F11 | Repressor RBP site present | A28 | — | **MISSING — A28 halts** |
| F12 | Repeat expansion, unit and length | A14 | — | **MISSING — A14 halts** |
| F13 | Polyadenylation site usage | A11 | — | **MISSING — A11 halts** |

F10 is deliberately split. A1 needs an accessible cleavable site *anywhere*;
A2 needs one specifically at the 5′ UTR or start codon. These are two
different queries and splitting them is what breaks the A1/A2 tie that
currently accounts for `outright_top1 = 0.545`.

### Modality-flag features (not a scored family)

Three features. All annotation lookups. None feeds a score.

| ID | Feature | Purpose | Source |
|---|---|---|---|
| **P2** | Residual endogenous transcript present and boostable | Decides boost-vs-replace. **Load-bearing for TG02 correctness.** | tissue expression atlas |
| **P6** | Dominant-negative allele present | Hard suppressor of the replacement flag: supplying more wild-type protein does not fix a dominant-negative disease | ClinVar + literature |
| **B1** | Target protein is extracellular or cell-surface | Gates the aptamer flag; pegaptanib is intravitreal against a secreted factor | UniProt localisation |

**Dropped from v2 and not to be implemented:** P1, P3, P4, P5, P7, B2, B3.
They were only needed to compute a score, and there is no score.

**Flag logic.**

```
replacement_flag = (all transcript-acting upregulation mechanisms below
                    the viability threshold)
                   AND P2 indicates low or absent boostable transcript
                   AND NOT P6

aptamer_flag     = (all transcript-acting silencing mechanisms below the
                    viability threshold)
                   AND B1 indicates an accessible extracellular target
```

The viability threshold is a de-novo parameter and needs a calibration
register entry (SO-TG-09).

---

## 2. Goal-level verdicts

| Goal | Mechs | Verdict | Rationale |
|---|---|---|---|
| **TG01** Gene Silencing | 5 | **SCORED — Tier A** | Approved drugs; A1-vs-A2 ties on half of inputs today |
| **TG02** Gene Activation | 6 | **SCORED — Tier A, first** | Six mechanisms, six distinct features. Best demonstration of the architecture. |
| **TG03** RNA Editing | 6 | **DEFERRED — Tier C, reframed** | Guide-design problem, not arbitration (§5) |
| **TG04** RNA Processing | 5 | **SCORED — Tier A** | Approved drugs; SpliceAI discriminates all five |
| **TG05** RNA Neutralization | 3 | **SCORED — narrow** | Only A14 is uniquely its own; halts pending F12 |
| **TG06** Translational Reg. | 4 | **RETIRED as scoring partition** | A2 → TG01; A5, A6 → TG02; only A27 unique, rated Low |
| **TG07** Isoform Engineering | 4 | **RETIRED as scoring partition** | Strict subset of TG04 — all four mechanisms identical |
| **TG08** Protein Replacement | 2 | **FLAG ONLY** | No approved therapy in this indication class to validate against |
| **TG09** Protein Function Mod. | 1 | **FLAG ONLY** | Single mechanism; aptamer design is structure-selection, not complementarity |

**Retiring TG06 and TG07 is about duplicate code paths, not scope.** TG07 =
{A7, A8, A9, A10} ⊂ TG04; A2/A5/A6 already score under TG01/TG02. Every
mechanism is kept, every rulebook is kept, and under inverted routing the goal
is a display label. Nothing is lost.

---

## 3. Routing: goal becomes an output

Nine of twenty-seven mechanisms belong to more than one goal:

| Mechanism | Goals | | Mechanism | Goals |
|---|---|---|---|---|
| A2 | TG01, TG06 | | A9 | TG04, TG07 |
| A5 | TG02, TG06 | | A10 | TG04, TG07 |
| A6 | TG02, TG06 | | A12 | TG01, TG05 |
| A7 | TG04, TG07 | | A25 | TG09, TG05 |
| A8 | TG04, TG07 | | | |

Because the user selects the goal *before* anything is scored, a mechanism in
two goals is scored in two contexts, and picking the wrong goal hides the
correct answer. This is the nusinersen failure in the mechanism-recovery
benchmark — intent is upregulation, mechanism lives under RNA processing —
generalised across five goal pairs.

**Decision: score all scored mechanisms in one pass; report the therapeutic
goal as an output label.** An optional goal *filter* may be applied **after**
scoring for a user who already knows what they want. It must never gate
scoring.

---

## 4. Mechanism states

Four states. Only the last is absence, and nothing is in it.

| State | Meaning | Mechanisms |
|---|---|---|
| **SCORED + DESIGNABLE** | competes; this platform emits candidates | A1–A10, A12, A13, A15–A20, A23, A27 |
| **SCORED + DESIGN NOT AVAILABLE** | competes; another pipeline required | **A21 only** |
| **HALTED** | in the choice set; required feature absent, says so | A11, A14, A28 |
| **FLAGGED** | surfaced qualitatively; never scored | A24, A25, A26 |
| **REMOVED** | not in the choice set | — none |

A21 keeps its scored-but-undesignable status because siRNA is a **genuine
competitor to A1** for any knockdown target — a real decision a scientist
makes — and it has five approved drugs, so it is fully validatable. That is
precisely what A24/A26 lack, which is why they are flagged rather than scored.
The distinction is validatability, not modality.

Reason strings, one per undesignable or flagged mechanism:

- **A21** — requires a double-stranded siRNA duplex; this designer emits
  single strands only.
- **A24** — requires codon optimisation, UTR design, and cap/polyA selection.
- **A26** — requires circularisation strategy and IRES selection.
- **A25** — requires structure-based selection (SELEX), not antisense
  complementarity.

---

## 5. Tier assignments

### Tier A — build first, build together

The three share a feature vocabulary; building them sequentially pays for
SpliceAI and the uORF work twice.

**TG02 Gene Activation — start here.** Six mechanisms, each requiring a
different feature: A3/F4 poison exon, A4/F6 antisense transcript, A5/F5 uORF,
A6/F7 miRNA site, A23/F8 promoter state, A28/F11 RBP site (halts). Plus the
replacement flag via P2 and P6. Nothing else in the system demonstrates the
architecture as clearly, and the boost-versus-replace contrast is the single
most compelling output the platform produces.

*Ground truth caveat:* TG02 has no approved drug. Validation rests on
clinical-stage programmes with published mechanisms and citations. State this;
do not work around it.

**TG01 Gene Silencing.** A1, A2, A12, A15 scored; A21 scored-undesignable;
aptamer flag via B1. The substantive work is splitting F10 into F10a/F10b to
break the A1/A2 tie.

**TG04 RNA Processing.** A7–A10 anchored by approved drugs; A11 halts.
*Critical:* TG04 is currently a **bijection** — each splice defect type maps
to exactly one mechanism regardless of every other input, verified across all
exon and delivery combinations. Top-1 is 1.00 and means nothing because the
input contains the answer. Replacing the defect dropdown with SpliceAI output
is what makes this goal a real test.

### Tier B — narrow

**TG05 RNA Neutralization.** A12 and A25 are handled elsewhere; only A14 is
uniquely its own, and it halts pending F12 (repeat expansion detection).
The defect class — toxic repeat-expansion transcripts forming nuclear foci —
is genuinely distinct, and `rank_rna_neutralization_mechanisms` already
handles repeat unit and count, which nothing else does.

### Tier C — TG03 RNA Editing, deferred and reframed

Six mechanisms (A13, A16–A20), none with an FDA-approved drug.

Two reasons to defer. First, **mechanism choice is near-bijective**: the
required edit is determined by the variant — A→G needs A-to-I (A13/A17/A19),
G→A needs C-to-U (A16), larger lesions need trans-splicing (A20). Same trap
TG04 is in today. Second, **the hard part is guide design**: ADAR guides need
a specific mismatch structure at the target adenosine and bystander-edit
minimisation across the guide window, which is a different design problem from
antisense complementarity and needs its own rulebook.

Sub-decision: A13, A17 and A19 all recruit ADAR and differ mainly in whether
the effector is endogenous or delivered. That is a **delivery** decision, not
a target-selection one; modelling it as three competing mechanisms overstates
the arbitration.

**Do:** keep all six; wire the variant → edit-type lookup. **Do not** claim
mechanism arbitration for TG03. Revisit as a guide-design module after Tier A.

---

## 6. Data-quality defects to fix

### 6.1 A24's `fdaApprovedDrugs` field is misleading — fix regardless
It lists **Comirnaty and Spikevax**, which are vaccines: a different
indication class from protein replacement. **There is no approved mRNA protein
replacement therapy.** If this field feeds an evidence weight or confidence
cap anywhere, A24 carries an unearned reliability tier. Correct it, and audit
every `fdaApprovedDrugs` field platform-wide for the same category error.

### 6.2 A22 does not exist
IDs run A1–A21 and A23–A28. **A22 is absent from `rulebooks/`.** Resolve
before publishing any mechanism count.

### 6.3 Three transcript features missing
F11 (RBP site), F12 (repeat expansion), F13 (polyadenylation). A28, A14 and
A11 halt on ABSENT until they exist. Do not guess.

### 6.4 Compatibility tables duplicate the rulebooks
`DEFECT_COMPATIBILITY`, `SCOPE_COMPATIBILITY`,
`UPREGULATION_DEFECT_COMPATIBILITY` and `SPLICE_DEFECT_COMPATIBILITY` restate
`suitableVariantTypes` and `molecularDefect` from `rule.json`. Two sources of
truth that can silently diverge; the rulebooks are the better curated.

### 6.5 Candidate new mechanism — allele-selective RNase H gapmer
Currently a modifier (`silencing_scope = allele_specific`) on A1/A2, but the
design rules genuinely differ: the oligonucleotide must be centred on the
discriminating variant, mismatch discrimination becomes a hard gate, and the
off-target concern inverts — the wild-type allele becomes the thing to avoid.
**Decision: keep as a modifier.** If Tier A shows allele-selective designs
failing gates that non-selective designs pass, split it out then.

### 6.6 Not to be added
**Cas13 RNA targeting** (protein effector) and **DNA-editing guide design**
(DNA target). Unlike A24/A25/A26 these do not compete for the same clinical
decision, and adding them would dilute a coherent claim.

---

## 7. Implementation checklist

Items 1–5 are refactors. The benchmark output must not change across them —
that is the correctness check. Nothing new lands before they do.

1. **Collapse the five `rank_*_mechanisms` functions into one arbitration.**
   Goal becomes an output field. Optional post-scoring filter only.
2. **Move `required_features` and `forbidden_features` into each
   `rule.json`.** Delete the four compatibility tables (§6.4).
3. **Generalise `NON_DESIGNABLE` to a per-mechanism `design_available` flag**
   with a reason string. Applies to A21 only among scored mechanisms.
4. **Add a `flag_only` mechanism state** for A24, A25, A26 — surfaced as text,
   never scored, never ranked.
5. **Retire TG06 and TG07 as scoring partitions.** Keep all mechanisms, all
   rulebooks, and the goal names as display tags.
6. **Fix A24's `fdaApprovedDrugs`** (§6.1) and audit the field platform-wide.
7. **Wire F1–F3 (SpliceAI)** → A7–A10 and A3.
8. **Wire F6, F7, F8** (annotation and off-the-shelf) → A4, A6, A23, A15.
9. **Wire F4, F5** annotation-first with model fallback
   (`scoring_and_ml_plan.md` §6.1b).
10. **Split F10 into F10a and F10b** to break the A1/A2 tie.
11. **Implement P2, P6 and B1** — annotation lookups only — and the flag logic.
12. **Halt A11, A14, A28 on ABSENT.**
13. **Extend the mechanism-recovery benchmark to goal-agnostic scoring**: gene
    and variant in, all scored mechanisms out, flags reported separately and
    never scored. This is the version of B1 worth publishing.
14. **Resolve the A22 gap** (§6.2).
15. **Rename the repository.** `aso-platform-claude-review` contradicts the
    positioning.

---

## 8. Summary

| Goal | State | Scored mechanisms | Halted | Flagged |
|---|---|---|---|---|
| TG01 Silencing | Tier A | A1, A2, A12, A15 (+A21 undesignable) | — | — |
| TG02 Activation | Tier A, first | A3, A4, A5, A6, A23 | A28 | — |
| TG03 Editing | deferred | A13, A16–A20 | — | — |
| TG04 Processing | Tier A | A7, A8, A9, A10 | A11 | — |
| TG05 Neutralization | narrow | — | A14 | — |
| TG06 Translational Reg. | retired as partition | A27 scored; A2/A5/A6 elsewhere | — | — |
| TG07 Isoform Eng. | retired as partition | identical to TG04 | — | — |
| TG08 Replacement | flag only | — | — | A24, A26 |
| TG09 Protein Function | flag only | — | — | A25 |

**No mechanism is removed. No goal is removed.** What changes: which
mechanisms are scored, which halt pending evidence, which are scored but
undesignable here, and which are surfaced as an unscored flag.

---

## 9. Sign-off items

- **SO-TG-01** Retiring TG06 and TG07 as scoring partitions — product decision.
- **SO-TG-03** A22: establish what it was and why it is absent.
- **SO-TG-04** A15 confidence cap: what ceiling does a Low–Moderate,
  no-FDA-drug mechanism receive, and is it applied uniformly at that tier?
- **SO-TG-06** TG02 has no approved drug. Agree the validation standard for a
  goal whose ground truth is clinical-stage only.
- **SO-TG-09** Viability threshold below which all transcript-acting
  mechanisms are considered non-viable, triggering the modality flag. De-novo
  parameter; needs a value and a calibration register entry.
- **SO-TG-10** Confirm the promotion condition for A24/A26 (§0): an approved
  replacement therapy in a validatable indication class, not a vaccine.

*Withdrawn:* SO-TG-02 (v1 proposed removing TG08), SO-TG-05 (allele-selective
resolved as a modifier, §6.5), SO-TG-07 and SO-TG-08 (v2 cross-family ranking
and P2 preference weighting — both moot now that nothing is scored across
families).
