# Therapeutic goal scope — implementation notes

Records what was built against `therapeutic_goal_scope_plan_v3.md` and
`data_sources_halted_flagged.md`, the judgement calls made where the plans
left room, and the questions that came back open.

Read this alongside the plans, not instead of them. Where this document and a
plan disagree, the plan is the intent and this is the report.

---

## 1. SO-TG-03 — A22 is resolved

**A22 has never existed in this repository.**

Evidence, from the full history of every branch:

- No commit has ever added, modified or deleted anything under
  `backend/rulebooks/A22/`.
- The initial import (`966a7fd`) created A1–A21 and A23–A28 in one commit.
  A22 was already absent at that point.
- No file in any commit of that import references the string `A22`. The only
  occurrences anywhere in history are in the scope plans themselves, asking
  this question.

So this is not a deletion. The gap arrived with the mechanism dataset and
predates version control here; whatever A22 was, if anything, it was dropped
before the rulebooks were first committed. Nothing in the codebase, the paper
or the docs claims 28 mechanisms — every count that exists says 27, and that
count is correct.

**Action taken.** `all_mechanism_ids()` enumerates the rulebook directory and
sorts numerically rather than iterating a contiguous range, so the gap cannot
produce a phantom lookup. A test asserts 27 rulebooks and that A22 is not
among them. Nothing else is needed.

**Residual risk:** if the upstream dataset A1–A28 was authored elsewhere and
A22 exists there, this repository is missing a mechanism rather than
containing a numbering gap. Confirming that needs the original dataset, which
is not in this repository. Worth one question to whoever supplied it.

---

## 2. Judgement calls

Each of these is a place where the plans set a direction and the
implementation had to pick a specific behaviour.

### 2.1 A required feature that cannot be resolved halts the mechanism

The plans name A11, A14 and A28 as halting. The implementation applies the
rule generally: any mechanism whose required feature resolves UNRESOLVED
halts. Those three are simply the ones with no source at all today.

Consequence worth noting: **A15 also halts now**, because v3 assigns it F8
(promoter methylation / accessibility) and no methylation atlas is wired.
That was not called out in v3's summary table, which still lists A15 as
scored. It follows from v3 §1 and item 8, and halting is the behaviour the
plans ask for everywhere else, so it was applied — but it is a change to a
mechanism v3 describes as scored, and it should be confirmed.

### 2.2 Required versus discriminating features

The plans name `required_features` and `forbidden_features`. A third
category was necessary: item 10 asks F10a/F10b to **break the A1/A2 tie**, and
a tie-break is by definition not a gate — both mechanisms stay eligible when
accessibility cannot be computed.

So `requiredFeatures` halt on unresolved, `discriminatingFeatures` are
skipped. F10a/F10b and F9 are discriminating; everything else is required.

### 2.3 The user's dropdown as a feature source

Most features fall back to the user's own molecular-defect selection when no
annotation or model is wired. That rung is marked `standIn: true`, capped at
the `user_asserted` provenance tier, and surfaced in the rationale as *"Every
feature supporting this mechanism is your own form input echoed back."*

This is not a workaround, it is the current state of the system made visible.
The plans' own critique of TG04 is that the defect dropdown already contains
the answer; this makes that legible in the output and measurable in the
benchmark (`stand_in_only`), instead of leaving it as a footnote.

**Two features deliberately have no user rung**: F11 and F13. Naming a target
RBP says which protein you have in mind; it is not evidence that a repressive
site exists in this transcript. A28 and A11 therefore always halt.

### 2.4 New vocabulary terms

Unioning four per-goal defect vocabularies into one left three gaps, each
filled from a rulebook's own text rather than invented:

| Term | From | Why it was needed |
|---|---|---|
| `correctable_point_variant` | A13/A16–A19 `molecularDefect` | TG03 gated on an edit-type dropdown, so its mechanisms declared no defect class and were eligible for every input |
| `coding_region_lesion` | A20 `molecularDefect` | same |
| `structured_element_dysregulation` | A27 `molecularDefect` | TG06 gated on a (goal, element) pair, which no longer exists |

Two aliases were added for terms that meant the same thing in two
vocabularies: `pathogenic_mirna` → `mirna_dysregulation`, and
`loss_of_function` → `haploinsufficiency` (TG05's own label for it was "Pure
loss-of-function (haploinsufficiency / null)").

### 2.5 SO-TG-04 — the confidence cap, answered provisionally

Caps are derived uniformly from each rulebook's evidence rating rather than
hand-set per mechanism: Very High 0.95, High 0.90, Moderate–High 0.80,
Moderate 0.70, Low–Moderate 0.55, Low 0.40. An unparseable rating gets the
lowest cap, not no cap.

This answers the "is it applied uniformly at that tier?" half of SO-TG-04
with yes. The specific numbers are a defensible default, not a settled
decision. They affect presentation only — no cap changes which mechanisms are
eligible.

### 2.6 P6 has an interim proxy

`data_sources_halted_flagged.md` specifies ClinGen Dosage Sensitivity as the
P6 source, with a curated exclusion list beside it. Neither is populated.

Until they are, P6 resolves from one inference: a user who classified the
defect as `haploinsufficiency` has said the disease is a dosage problem, and
haploinsufficiency and dominant-negative are the standard contrasting models
for a dominant disorder. That is recorded at the `user_asserted` tier and is
exactly the rung a ClinGen lookup should displace.

Any other defect leaves P6 unresolved, which **withholds the flag**. That is
the safe direction the data-sources document asks for: a missing suggestion
costs a prompt, a wrong suggestion to replace a protein in a
dominant-negative disease is substantively harmful.

---

## 3. Where the plans conflict with themselves

### 3.1 v3 item 3 moves the benchmark, which v3 §7 says must not happen

v3 §7 states that items 1–5 are refactors and *"the benchmark output must not
change across them — that is the correctness check."*

Item 3 changes it, unavoidably. Making A21 a scored, competing mechanism puts
a Very High evidence rating against A1's High, so A21 now ranks above A1 on
every knockdown case. `top1_exact` fell from 1.00 to 0.688.

This is not a regression in the ranking — it is the ranking doing what item 3
asks. But it means item 3 is a behaviour change wearing a refactor's label,
and the stated correctness check cannot be applied to it.

**What was done.** The five approved siRNA drugs were added as benchmark
cases. Excluding the very drugs that make A21 validatable — which is v3's own
argument for scoring it — would leave the benchmark measuring a mechanism set
the platform no longer uses. A `design_available` reading is reported beside
`strict`.

**What it exposes.** On gene, defect and delivery alone the platform cannot
separate a gapmer target from an siRNA target, because nothing in those
inputs distinguishes them. TTR carries an approved drug of each kind at
identical inputs, so no ranking over this input set can be right about both.
That is a real limitation and it is now measured rather than hidden by
excluding half the evidence.

**Open question.** If the single-stranded constraint is a real design input —
and for a user of this designer it is — it should be an input, not something
the benchmark works around. That would be a new context field, so it was not
added unilaterally.

### 3.2 v3's Family T table and §5 disagree about A3

The table gives F1 to "A8, A3"; §5 gives A3 its feature as F4. Both were
applied: F4 gates A3, F1 sharpens it. A7 is listed against no feature in the
table but is included in item 7's "F1–F3 → A7–A10 and A3", so it keeps F1.

---

## 4. Open sign-off items

Carried forward from v3 §9, plus what the implementation added.

| Item | Status |
|---|---|
| **SO-TG-01** Retiring TG06/TG07 as scoring partitions | Implemented; product sign-off still needed. Both survive as display tags and every mechanism remains available. |
| **SO-TG-03** A22 | **Resolved** — see §1. Never existed here. |
| **SO-TG-04** Confidence cap tiers | Provisionally answered — see §2.5. Numbers need agreement. |
| **SO-TG-06** TG02 validation standard | Open. No approved drug for the goal; validation rests on clinical-stage programmes. |
| **SO-TG-09** Viability threshold | Open. Implemented as `VIABILITY_THRESHOLD = 0.30`, a de-novo parameter with no calibration behind it. |
| **SO-TG-10** A24/A26 promotion condition | Open. Recorded in the retirement notice: an approved replacement therapy in a validatable indication class, not a vaccine. |
| **SO-DATA-01** P2 cut points | Open. Implemented as 0.5 / 5.0 TPM, both de-novo. |
| **SO-DATA-02** ClinGen score → P6 mapping | Open, and blocking a real P6. Codes 30 and 40 are not points on an ordinal scale and must not be parsed as one. |
| **SO-DATA-03** F11 route | Open. Curated-list route recommended; A28 stays halted meanwhile. |
| **SO-DATA-04** Licence review for derived tables | Open, and blocking population of every reference table. |
| **SO-DATA-05** Table refresh cadence | Open. |

### Added by this implementation

- **SO-IMPL-01** — the accessibility parameters behind F10a/F10b
  (`ACCESSIBLE_SITE_THRESHOLD = 0.05`, `DESIGNABLE_SITE_TARGET = 5`) are
  uncalibrated placeholders. They shift how sharply A1 and A2 separate, never
  whether either is eligible.
- **SO-IMPL-02** — A15 now halts (§2.1). Confirm that is intended, given v3's
  summary table lists it as scored.
- **SO-IMPL-03** — should the single-stranded design constraint become an
  explicit input, so A21 can compete on merit without making every
  gapmer case unrecoverable (§3.1)?

---

## 5. Not done

- **Items 7–9 (SpliceAI, TargetScan, methylation atlas)** — not wired. These
  need model installs and licensed data. F1–F3, F7 and F8 fall back to the
  user's defect selection, marked as stand-ins; A15 halts.
- **Reference tables** — schemas and loader shipped, all four tables
  header-only. Populating them from recalled knowledge would put unverifiable
  data behind an `annotation` provenance label, which is the strongest tier
  short of experimental measurement. See
  `backend/data/reference/README.md`.
- **Item 15, renaming the repository** — this is an outward-facing change to
  a GitHub repository and needs the owner to make it.
- **Frontend** — the TG09 page still expects generated aptamer candidates and
  will render an empty list; the per-goal pages do not yet surface
  `status`, `designAvailable` or `modalityFlags`. The backend is
  backward-compatible, so nothing errors, but the new information is
  invisible until the pages are updated.
- **`intron_retention` in `ISOFORM_GOAL_DEFECT_MAP`** maps to a defect served
  only by A11, which is not a TG07 mechanism, so that row has always returned
  an empty ranking. Preserved verbatim rather than quietly repaired —
  correcting it is a product decision about what "intron retention" should
  mean here.
