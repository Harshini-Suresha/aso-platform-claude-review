# ML serving integration plan (item 8)

Status: **not implemented**. This is a plan document only, written in response to
a request to detail how to wire a trained model into the live product paths
(TG01 Gene Silencing, TG02 Gene Upregulation, TG04 RNA Processing Modulation)
so `learnedEfficacy` in `AssoCandidate` stops being a hardcoded
`{"available": false, "value": null, "modelInfo": "Not yet trained"}` stub.

## 0. Correction to PROJECT_HANDOFF.md §8

The handoff states this snapshot excludes `backend/checkpoints/*.pth`,
`backend/pretrained/`, and the embedding caches, and on that basis an earlier
pass of this review concluded there was nothing to serve. **That conclusion
was wrong for this snapshot.** Real, non-empty, loadable PyTorch checkpoints
are committed under paths the handoff's exclusion list doesn't cover:

| Path | Size | What it is |
|---|---|---|
| `backend/results/benchmark/ranker_ablation_conditioned/ranker.pt` | ~1.5MB | `InvariantRanker(mode="conditioned")` — the exact checkpoint behind the headline Table 1 result PROJECT_HANDOFF.md §4 cites (topk_w 0.348, Pearson 0.362) |
| `backend/results/benchmark/ranker_ablation_seqonly/ranker.pt` | ~1.5MB | Same architecture, `mode="seqonly"` (no chemistry conditioning), topk_w 0.327 |
| `backend/results/benchmark/ranker_v2/ranker.pt`, `ranker_v3/ranker.pt` | ~0.8–1.5MB | `mode="invariant"` variants (GRL chemistry-adversarial); handoff reports invariance regularization *hurts* transfer, so these are not recommended for serving |
| `backend/results/benchmark/generative_v3/generator.pt` | ~1.8MB | The CVAE generator — not directly relevant to scoring existing candidates, see §5 |
| `backend/models/fusion_best.pt`, `backend/experiments/exp*/best_model.pt` | 3–10MB each | Earlier OligoFormer-style efficacy models (fusion / cross-attention / token-attention). Not evaluated here; each has its own `metrics.json`/`config.yaml` worth reading before considering them, but they are a second, separate research thread from the `invariant_ranker` line this plan targets. |

Recommended model to serve: **`ranker_ablation_seqonly/ranker.pt`**, not the
higher-scoring conditioned checkpoint. Reason in §2.

## 1. What this model is and isn't

`InvariantRanker` (`backend/experiments/benchmark/invariant_ranker.py`) is a
small CNN encoder + MLP head trained with **pairwise `MarginRankingLoss`
within experiment groups** — it has never seen an absolute-efficacy target.
Its output (`RankHead`'s final layer is a plain `nn.Linear(hidden, 1)`, no
bounding activation) is an **unbounded real number whose only trained
property is relative order within a batch of candidates from the same
context**. It is not:

- a probability or confidence (no sigmoid/calibration head),
- a predicted knockdown percentage,
- comparable in absolute value across two different genes/candidate sets,
- validated above a cross-gene rank-transfer ceiling of ≈0.30 (top-10 overlap)
  / ≈0.30 Pearson, per PROJECT_HANDOFF.md §4 — and that ceiling is itself
  measured on curated benchmark data, not on ASOs actually synthesized.

Presenting the raw score as `learnedEfficacy.value: 87.3` or similar would be
the exact CRITICAL 3 failure mode (a fabricated-looking statistic) applied to
a real model instead of a hardcoded literal — the score is real, but the
implied precision would not be.

## 2. The concrete integration gap: chemistry representation mismatch

The `conditioned`/`invariant` modes need a `chemistry_fingerprint` string,
built by `backend/data_curation/aso_atlas.py::chemistry_fingerprint()` from
the *training data's* schema: `"L{length} {modification}|{type}|{positions}"`
per base-level modification, e.g. `"L18 2MOE|sugar|0,1,2,15,16,17 PS|backbone|0,1,2,...,17"`.

The product's chemistry vocabulary (`CHEMISTRY_OPTIONS` in
`gene_silencing_service.py`: `gapmer`, `pmo`, `lna_gapmer`, `2ome`) is a
coarse, four-value id — it does not carry per-base modification positions and
cannot be losslessly mapped to the training fingerprint format. Any mapping
attempted (e.g. "gapmer" → some canonical `L{n} ...` string) would be an
*invented* correspondence, not a real one — the same category of problem
CRITICAL 3 flagged.

**Recommendation: serve the `seqonly` checkpoint, not `conditioned`.**
`seqonly` never needs `chemistry_fingerprint` at inference — it scores from
sequence alone — and its reported topk_w (0.327) is close enough to
`conditioned`'s (0.348) that the accuracy given up is small relative to the
honesty problem avoided. This should be stated in `modelInfo` verbatim so a
user can see the tradeoff was made deliberately, not silently.

If `conditioned` is wanted later, the correct fix is on the *training* side —
retrain with a fingerprint scheme built from the product's own chemistry/
modification vocabulary — not a translation layer invented at serving time.

## 3. Sequence alphabet mismatch (real, must be handled, cheap to fix)

Training data is RNA-alphabet (`NUCLEOTIDES = "ACGU"`, T→U normalized in
`backend/data_curation/unified.py`, per PROJECT_HANDOFF.md §7's own drift
warning). Product candidate sequences (`AssoCandidate.sequence`, produced by
`_reverse_complement()` in `gene_silencing_service.py`) are DNA-alphabet
(contain `T`). `invariant_ranker.seq_to_onehot()` one-hots against `"ACGU"` —
a `T` in the input silently one-hots to nothing (falls into the `idx < 0`
mask), which would score every real candidate as if it were shorter than it
is. **This must be `.replace("T", "U")` before scoring — not optional, not
covered by any existing test.**

`MAX_LEN = 40` in the training code comfortably covers the product's
`LENGTH_RANGE` (12–30 nt), so no truncation handling is needed.

## 4. `backend/inference/` module design

New package, imported by services, never by `backend/experiments/*` (keeps
the existing clean boundary — experiments scripts must stay runnable
standalone without the FastAPI service stack; today nothing under
`backend/experiments/` imports from `backend/services/` and this shouldn't
introduce the first such edge in the other direction either).

```
backend/inference/
  __init__.py
  ranker.py        # loads InvariantRanker once, exposes score_sequences()
```

`ranker.py` sketch (not implemented):

```python
import functools
from pathlib import Path

CHECKPOINT = Path(__file__).resolve().parents[1] / "results/benchmark/ranker_ablation_seqonly/ranker.pt"

@functools.lru_cache(maxsize=1)
def _load():
    # Imports invariant_ranker lazily so a missing/incompatible torch install
    # degrades to "model unavailable" (see §6) rather than crashing the app
    # at import time.
    from backend.experiments.benchmark.invariant_ranker import load_scorer
    if not CHECKPOINT.exists():
        return None
    return load_scorer(CHECKPOINT)  # (model, chem_vocab, mode)

def score_sequences(sequences: list[str]) -> list[float] | None:
    """Raw, unbounded pairwise-ranking scores. None if the model isn't
    available. Caller must not present these as a percentage or confidence —
    see docs/ml_serving_integration_plan.md §5-6."""
    loaded = _load()
    if loaded is None:
        return None
    model, chem_vocab, mode = loaded
    import torch
    from backend.experiments.benchmark.invariant_ranker import seq_to_onehot
    rna_seqs = [s.upper().replace("T", "U") for s in sequences]
    with torch.no_grad():
        oh = torch.from_numpy(seq_to_onehot(rna_seqs))
        scores = model.score(oh).numpy()
    return scores.tolist()
```

`functools.lru_cache(maxsize=1)` loads the checkpoint once per process on
first use, not per-request and not at app startup (avoids paying the load
cost — and failing the whole app — if a deployment never hits a scoring
path). A real implementation should decide explicitly whether cold-start
latency on the first request is acceptable or whether an app-startup
`@app.on_event("startup")` preload is worth the coupling.

## 5. Where it plugs into the three live areas

`AssoCandidate.learnedEfficacy` is already the exact-shaped integration point
— it exists as a stub in `gene_silencing_service.py` (TG01) and
`rna_processing_service.py` (TG04) today:

```python
"learnedEfficacy": {
    "available": False,
    "value": None,
    "modelInfo": "Not yet trained",
    "scopeCaveat": None,
},
```

Integration is: after candidate generation produces the final `aso_seq` list
for a request, call `inference.ranker.score_sequences([c["sequence"] for c in
candidates])` once (batched, not per-candidate) and fill in each candidate's
`learnedEfficacy` block. `gene_upregulation_service.py` (TG02) does not yet
have this stub field at all — check it against `AssoCandidate`'s shape and
add it there too if TG02 is in scope when this is implemented, so the three
live areas stay consistent rather than two-of-three gaining a feature quietly.

This must **not** feed into `_composite_score` / candidate ranking order.
`_composite_score`'s own docstring in `gene_silencing_service.py` is explicit
that ranking is "built exclusively from real, physics-based metrics" and
heuristics are "deliberately excluded... surfaced... as labeled estimates
rather than silently voted into the ranking." A ranking-loss-trained score
with a ≈0.30 transfer ceiling is not more trustworthy than that policy
already assumes — it belongs in the same "labeled, non-ranking-affecting"
category as `heuristicEstimates`, not folded into `compositeScore`.

## 6. The confidence cap

This is the specific risk PROJECT_HANDOFF.md's `gsdesign` comparison flags:
*"Nothing in this platform is bounded by the fact that no candidate has been
synthesised. Once the ML is actually served, an uncapped model confidence
will be the most misleading number on the screen."*

Concretely, for this model:

1. **Never render the raw score as a 0–100 "confidence" or percentage.** It
   has no such calibration and was never trained to produce one — doing so
   reproduces CRITICAL 3 (a real number, dressed as a more precise one than
   it is).
2. **Only present it as a within-batch relative rank** (e.g. "3rd of 12
   candidates by learned ranking model" or a raw min-max-normalized-within-
   this-batch bar), since relative order within one scoring call is the one
   thing the training objective actually optimized for.
3. **Always populate `scopeCaveat`**, not as an optional aside but inline
   with the number, e.g.: `"Relative ranking score from a model with a
   measured cross-gene transfer ceiling of ~0.30 (top-10 overlap); not
   validated on synthesized candidates; do not treat as a predicted
   knockdown or efficacy percentage."` The field already exists in the type
   for exactly this purpose and is currently always `null` — filling in the
   score without filling in this field would be worse than leaving the
   stub as-is.
4. **`available: true` only when a checkpoint actually loaded.** If
   `inference.ranker.score_sequences()` returns `None` (missing checkpoint,
   incompatible torch version, any load failure), `learnedEfficacy` must stay
   `{"available": false, "value": None, "modelInfo": "Not yet trained", ...}`
   — fail closed to the existing honest stub, never fall back to a heuristic
   number presented under the "learned" label. Categories don't blend
   (PROJECT_HANDOFF.md §2's four-category rule): a Learned field that can't
   load must not silently become a Heuristic one.

## 7. Sequencing

1. Add `torch` to whatever's actually installed in the serving environment
   (it's already in `backend/requirements.txt` but wasn't installed in the
   sandbox this review ran in — confirm it's present where the API actually
   runs).
2. Build `backend/inference/ranker.py` per §4; unit-test the T→U normalization
   and the "checkpoint missing → returns None, doesn't raise" path
   specifically, since both are easy to get wrong silently.
3. Wire into TG01 (`gene_silencing_service.generate_candidates`) and TG04
   (`rna_processing_service.generate_rna_processing_candidates`) per §5.
   Decide deliberately whether TG02 gets the same field added at the same
   time or is tracked as a followup — don't let it become invisible-by-omission
   the way the TG04 homepage card was.
4. Frontend: `AssoCandidateCard`/`AsoAnalysisDashboard` need a rendering path
   for `learnedEfficacy.available === true` that implements §6 (rank display,
   not a percentage; `scopeCaveat` shown, not hidden behind a tooltip).
5. Only after 1–4: consider whether `conditioned` mode is worth the honest
   chemistry-fingerprint mapping work described in §2, as a separate,
   explicitly-scoped followup.

Steps 1–3 are backend-only and are the bulk of the real work; step 2 is where
a wrong assumption (alphabet, chemistry format, or silent-heuristic-fallback)
would most easily reintroduce the failure mode this whole review is about.
