# Therapeutic goal and mechanism scope — implementation plan

Companion to `scoring_and_ml_plan.md` and `model_training_specs.md`.

Decides, for each of the 9 therapeutic goals and 27 mechanisms: what gets
implemented, what stays, what goes, and what is missing.

Verified against `backend/rulebooks/` and `backend/services/mechanism_service.py`
at commit `f26dec2` plus the Phase 0 branch.

---

## 0. The finding that drives everything below

**The 9 goals are not 9 separate scoring problems, and building them that way
is the current architecture's main defect.**

Nine of twenty-seven mechanisms belong to more than one goal:

| Mechanism | Goals |
|---|---|
| A2 Steric-block translation inhibition | TG01, TG06 |
| A5 uORF blocking | TG02, TG06 |
| A6 miRNA site blocking | TG02, TG06 |
| A7 Exon skipping | TG04, TG07 |
| A8 Exon inclusion | TG04, TG07 |
| A9 Pseudoexon suppression | TG04, TG07 |
| A10 Cryptic splice-site blocking | TG04, TG07 |
| A12 microRNA inhibition | TG01, TG05 |
| A25 RNA aptamer | TG09, TG05 |

Goal overlaps: TG04∩TG07 = 4 mechanisms (**TG07 is a strict subset of TG04**),
TG02∩TG06 = 2, TG01∩TG05 = 1, TG01∩TG06 = 1, TG05∩TG09 = 1.

Because the user selects the goal *before* anything is scored, a mechanism
that lives in two goals is scored in two different contexts, and choosing the
wrong goal hides the correct answer entirely. This is the nusinersen failure
from the mechanism-recovery benchmark — therapeutic intent is upregulation,
mechanism lives under RNA processing — generalised across five goal pairs.

### Decision: invert the routing

Score **all designable mechanisms in one pass** against the gene. Report the
therapeutic goal as an **output label**, not an input.

An optional goal *filter* may be applied **after** scoring for a user who
already knows what they want. It must never gate scoring.

Consequences:
- the nusinersen class of failure disappears structurally
- nine duplicate scoring paths collapse into one
- the arbitration claim strengthens: arbitrating across 27 mechanisms spanning
  fundamentally different strategies is a much harder problem than picking
  among five inside a goal the user already named
- less code, not more

**Building nine scoring systems is the wrong project.** Building one
arbitration over 27 mechanisms is the right one, and it is less work.

---

## 1. Goal-level verdicts

| Goal | Mechs | Verdict | Rationale |
|---|---|---|---|
| **TG01** Gene Silencing | 5 | **KEEP — Tier A** | Approved drugs for ground truth. A1-vs-A2 ties on 50% of inputs today: a real discrimination the biology layer must break. |
| **TG02** Gene Activation | 6 | **KEEP — Tier A, highest priority** | The best arbitration case in the system. See §2. |
| **TG03** RNA Editing | 6 | **KEEP — Tier C, defer** | Not an arbitration problem; it is a guide-design problem. See §4. |
| **TG04** RNA Processing | 5 | **KEEP — Tier A** | Approved drugs; SpliceAI discriminates all five directly. |
| **TG05** RNA Neutralization | 3 | **KEEP — Tier B, thin** | Only A14 is genuinely its own; A12 and A25 are borrowed. |
| **TG06** Translational Regulation | 4 | **RETIRE AS A GOAL** | 3 of 4 mechanisms belong to TG01/TG02. See §3.1. |
| **TG07** Isoform Engineering | 4 | **RETIRE AS A GOAL** | Strict subset of TG04. See §3.2. |
| **TG08** Protein Replacement | 2 | **REMOVE FROM THIS DESIGNER** | Not oligonucleotide design. See §3.3. |
| **TG09** Protein Function Mod. | 1 | **DEMOTE TO LOOKUP** | One mechanism. Nothing to arbitrate. See §3.4. |

Net: **9 goals → 5 scored goals + 1 lookup + 1 out-of-scope.**

Under inverted routing these become display groupings rather than scoring
partitions, so retiring a goal costs the user nothing — the mechanisms remain
fully available.

---

## 2. Tier A — implement first

These three share the same feature vocabulary, so building them together is
materially cheaper than building them in sequence.

### TG02 — Gene Activation / Upregulation  ← START HERE

Six mechanisms, each requiring a **different** transcript feature. The
biology layer alone decides between them. Nothing else in the system
demonstrates the architecture as clearly.

| Mech | Requires | Feature | Source |
|---|---|---|---|
| A3 Poison exon blocking (TANGO) | NMD-inducing exon present | F4 | GENCODE NMD biotype → classifier fallback |
| A4 NAT knockdown | overlapping antisense transcript | F6 | annotation lookup, no ML |
| A5 uORF blocking | repressive uORF in 5′ UTR | F5 | literature list → regressor fallback |
| A6 miRNA site blocking | repressive miRNA site in 3′ UTR | F7 | TargetScan context++ |
| A23 saRNA activation | promoter accessible / silenced | F8 | methylation atlas |
| A28 RBP masking | repressor RBP site present | F11 (**new**) | see gaps, §6 |

**Implement:** required/forbidden feature lists in each `rule.json`; F4–F8
wired; A28 halts on ABSENT until F11 exists.

**Ground truth problem — state it openly.** No approved TG02 drug exists.
Validation must rest on clinical-stage programmes with published mechanisms,
carrying citations. Do not fabricate ground truth for this goal.

### TG01 — Gene Silencing

| Mech | Status | Notes |
|---|---|---|
| A1 RNase H gapmer | **KEEP** — anchor | 5 approved drugs |
| A2 Steric-block translation inhibition | **KEEP** | Ties with A1 on half of inputs; needs F10 site density + F9 allele discrimination to separate |
| A12 microRNA inhibition | **KEEP** | Distinct defect class; no overlap risk |
| A15 Transcriptional gene silencing | **KEEP, DEMOTE** | Evidence rating Low–Moderate, no FDA drug. Must not outrank A1 on a therapeutic-reduction case — this is what Phase 0 fixed. Cap its confidence accordingly. |
| A21 RNA interference | **KEEP, STAY NON-DESIGNABLE** | Biologically valid; the single-stranded designer cannot emit a duplex. Existing `NON_DESIGNABLE_SILENCING_MECHANISMS` handling is correct — do not remove it to make the goal look fuller. |

**The real work here is breaking the A1/A2 tie.** Currently
`outright_top1 = 0.545`, entirely because of it. A1 needs an accessible
cleavable site anywhere in the transcript; A2 needs an accessible site
specifically at the 5′ UTR or start codon. Those are different F10 queries and
they will separate the two.

### TG04 — RNA Processing Modulation

| Mech | Status | Feature |
|---|---|---|
| A7 Exon skipping | **KEEP** — anchor, 4 approved drugs | F1 |
| A8 Exon inclusion | **KEEP** — anchor, nusinersen | F1 |
| A9 Pseudoexon suppression | **KEEP** | F3 |
| A10 Cryptic splice-site blocking | **KEEP** | F2 |
| A11 APA modulation | **KEEP, LOW PRIORITY** | Low–Moderate evidence, no FDA drug, no shared feature — needs a polyadenylation-site predictor that does not exist. Halt on ABSENT rather than guess. |

**Critical fix.** TG04 is currently a **bijection**: each splice defect type
maps to exactly one mechanism regardless of every other input (verified across
all exon and delivery combinations). Top-1 is 1.00 and means nothing, because
the input already contains the answer. Replacing the defect dropdown with
SpliceAI output is what turns this goal into a real test.

---

## 3. Retirements

### 3.1 TG06 Translational Regulation — retire as a goal

A2 → TG01. A5, A6 → TG02. Only **A27 (riboswitch / RNA structure targeting)**
is uniquely TG06, and its evidence rating is **Low** with no FDA drug and no
clinical programme.

**Do:** keep all four mechanisms; delete TG06 as a scoring partition; retain
"translational regulation" as a display tag on A2/A5/A6/A27.
**Do not:** delete A27. Mark it research-stage, cap its confidence, let it
compete honestly and lose.

### 3.2 TG07 Isoform Engineering — retire as a goal

TG07 = {A7, A8, A9, A10} ⊂ TG04. **Every** TG07 mechanism is a TG04 mechanism.
Two scoring paths over an identical mechanism set is a guaranteed source of
divergence between two code paths that should never disagree.

**Do:** delete the TG07 scorer; keep "isoform engineering" as a display tag
where the therapeutic intent is isoform switching rather than defect
correction. Merge `rank_isoform_engineering_mechanisms` into the unified path.

### 3.3 TG08 Protein Replacement — remove from this designer

A24 (mRNA replacement) and A26 (circRNA) are **not oligonucleotides**.
Different molecule class, different length scale, different manufacturing,
different delivery, different regulatory path. A24's FDA precedent is the
COVID-19 vaccines — which tells you how far outside this system it sits.

Nothing in Sessions 1–8 — the siRNA rulebook, the gapmer rulebook, the
chemistry logic, the hepatotoxicity gate, the off-target model — applies to a
kilobase-scale mRNA.

**Do:** mark TG08 out of scope using the same mechanism as A21
(`NON_DESIGNABLE`), with an honest reason string. Keep the rulebooks — they
are good reference content — but never return A24/A26 as designable
candidates.
**Do not:** quietly leave it enabled. A user selecting TG08 today gets a
scoring path that cannot produce a valid design.

### 3.4 TG09 Protein Function Modulation — demote to lookup

TG09 = {A25}, and A25 also sits in TG05. **One mechanism means no
arbitration.** A ranking over a single item is not a ranking.

Note A25 (RNA aptamer, pegaptanib) is a real approved drug — but aptamer
design is structure-selection, not antisense complementarity. It shares almost
no design logic with the rest of the platform.

**Do:** return A25 as a direct lookup with its rulebook content; no score, no
rank. State plainly that aptamer design is out of scope for the sequence
designer.

---

## 4. Tier C — TG03 RNA Editing, defer and reframe

Six mechanisms: A13 (ADAR SDRE), A16 (C-to-U), A17 (LEAPER), A18 (CIRTS),
A19 (REPAIR), A20 (SMaRT). **None has an FDA-approved drug**; ratings run
Low–Moderate to Moderate, all preclinical or early clinical.

Two reasons to defer:

1. **Mechanism choice is near-bijective.** The required edit is determined by
   the variant: A→G correction needs A-to-I (A13/A17/A19), G→A needs C-to-U
   (A16), larger lesions need trans-splicing (A20). The arbitration is mostly
   a lookup on the variant, exactly the trap TG04 is in today.
2. **The hard part is guide design, not mechanism selection.** ADAR guides
   need a specific mismatch structure at the target adenosine and bystander-
   edit minimisation across the whole guide window. That is a different design
   problem from antisense complementarity and needs its own rulebook.

**Do:** keep all six; wire the variant → edit-type lookup, which is cheap and
honest; **do not** claim mechanism arbitration for TG03. Revisit after Tier A
ships, as a guide-design module rather than an arbitration one.

Sub-decision within TG03: A13, A17 and A19 all recruit ADAR and differ mainly
in whether the effector is endogenous or delivered. That distinction is a
*delivery* decision, not a target-selection one, and should be modelled as
such rather than as three competing mechanisms.

---

## 5. Tier B — TG05 RNA Neutralization

A12 (→ TG01), A25 (→ TG09), leaving **A14 (RNA toxicity neutralization / foci
disruption)** as the only mechanism genuinely its own. Moderate evidence, no
FDA drug, but a clear and distinct indication: repeat-expansion transcripts
forming nuclear foci.

**Keep TG05 as a scored goal** — narrowly. Its defect class (toxic RNA repeat
expansion) is genuinely distinct and the existing
`rank_rna_neutralization_mechanisms` already handles repeat unit and count,
which nothing else does.

**Required feature F12 (new):** repeat expansion detected, with unit and
estimated length. Currently user-supplied free text; should become an
annotation lookup against known repeat-expansion loci, which is a bounded and
well-catalogued set.

---

## 6. Gaps — mechanisms and features that are missing

### 6.1 A22 does not exist

IDs run A1–A21 and A23–A28. **A22 is absent from `rulebooks/`.** Either it was
removed or never written. Resolve before publishing any mechanism count: an
unexplained gap in an ID sequence invites the question of what was deleted and
why.

### 6.2 Feature F11 — repressor RBP site (blocks A28)

A28 (translation repressor site blocking) requires knowing that a repressive
RNA-binding-protein site exists in the transcript. No such feature exists.
Until it does, A28 must halt on ABSENT rather than score. Candidate sources
are CLIP-seq derived binding atlases; **MUST VERIFY** any specific resource
before use.

### 6.3 Feature F12 — repeat expansion (blocks A14 automation)

See §5.

### 6.4 Feature F13 — polyadenylation site usage (blocks A11)

A11 needs to know which polyadenylation site is used and whether shifting it
is therapeutically useful. No predictor is wired. Halt on ABSENT.

### 6.5 Candidate new mechanism: allele-selective RNase H gapmer

Currently allele-selective knockdown is handled by `silencing_scope =
allele_specific` as a *modifier* on A1/A2. But the design rules genuinely
differ — the oligonucleotide must be centred on the discriminating variant,
mismatch discrimination becomes a hard gate, and the off-target concern
inverts (the wild-type allele becomes the off-target to avoid).

**Recommendation:** keep it as a modifier for now, but flag it. If Tier A shows
allele-selective designs failing gates that non-selective designs pass, that
is evidence it deserves its own mechanism ID and rulebook.

### 6.6 Not recommended as new mechanisms

- **CRISPR-based RNA targeting (Cas13)** — a protein effector, not an
  oligonucleotide. Same category error as TG08.
- **Splice-modulating small molecules** — not a nucleic acid at all.
- **Guide RNA design for DNA editing** — out of scope by definition.

Resist the pull to broaden the mechanism list. The contribution is depth of
arbitration across a coherent modality, not breadth across all of RNA biology.

---

## 7. Implementation checklist

Ordered. Items 1–4 are refactors that must land before any new goal work.

1. **Collapse the five `rank_*_mechanisms` functions into one unified
   arbitration** over all designable mechanisms. Goal becomes an output field.
   Optional post-scoring goal filter.
2. **Move `required_features` and `forbidden_features` into each `rule.json`.**
   Delete `DEFECT_COMPATIBILITY`, `SCOPE_COMPATIBILITY`,
   `UPREGULATION_DEFECT_COMPATIBILITY`, `SPLICE_DEFECT_COMPATIBILITY` — they
   restate `suitableVariantTypes` and `molecularDefect` and can silently
   diverge from them.
3. **Mark TG08 (A24, A26) non-designable**, reusing the A21 pattern and reason
   string.
4. **Demote TG09 to a lookup**; delete the TG07 scorer; delete the TG06
   scorer. Retain all mechanisms and all rulebook content.
5. **Wire F1–F3 (SpliceAI)** → TG04 mechanisms + A3.
6. **Wire F6, F7, F8** (annotation and off-the-shelf) → TG02 mechanisms.
7. **Wire F4, F5 annotation-first**, model fallback per plan §6.1b.
8. **Split F10 into two queries** — transcript-wide site density (A1) and
   5′ UTR / start-codon site density (A2) — to break the A1/A2 tie.
9. **Halt A11, A14, A28 on ABSENT** until F11–F13 exist. Do not guess.
10. **Extend the mechanism-recovery benchmark to goal-agnostic scoring**: feed
    gene and variant only, score against all designable mechanisms. This is
    the version of B1 worth publishing.
11. **Resolve the A22 gap** (§6.1).

---

## 8. Summary table

| Goal | Now | After | Mechanisms kept | Removed from scoring |
|---|---|---|---|---|
| TG01 | scored | **scored (Tier A)** | A1, A2, A12, A15 | A21 stays non-designable |
| TG02 | scored | **scored (Tier A, first)** | A3, A4, A5, A6, A23, A28 | — (A28 halts pending F11) |
| TG03 | scored | **deferred, reframed** | A13, A16–A20 | arbitration claim withdrawn |
| TG04 | scored | **scored (Tier A)** | A7, A8, A9, A10 | A11 halts pending F13 |
| TG05 | scored | **scored (narrow)** | A14 | A12, A25 scored elsewhere |
| TG06 | scored | **retired as a goal** | A27 kept, display tag only | A2, A5, A6 scored elsewhere |
| TG07 | scored | **retired as a goal** | — | all 4 identical to TG04 |
| TG08 | scored | **out of scope** | — | A24, A26 non-designable |
| TG09 | scored | **lookup only** | A25 returned directly | no ranking |

**No mechanism is deleted.** Every rulebook stays. What changes is which
mechanisms are *scored*, which are *halted pending evidence*, and which are
*marked undesignable by this pipeline* — the same three-way distinction the
platform already applies to A21.

---

## 9. Sign-off items raised by this document

- **SO-TG-01** Retiring TG06, TG07 and TG09 as scoring partitions is a product
  decision as much as a technical one. Needs explicit sign-off.
- **SO-TG-02** Removing TG08 from the designer — confirm no downstream
  commitment depends on it.
- **SO-TG-03** A22: establish what it was and why it is absent.
- **SO-TG-04** A15 confidence cap: what ceiling does a Low–Moderate,
  no-FDA-drug mechanism get, and does it apply to every mechanism at that tier?
- **SO-TG-05** Allele-selective gapmer: modifier or its own mechanism ID
  (§6.5)?
- **SO-TG-06** TG02 has no approved drug. Agree the validation standard for a
  goal whose ground truth is clinical-stage only.
