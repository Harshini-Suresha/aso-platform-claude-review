"""M2 — LightGBM lambdarank on the RNase-H arm, with the specified fixes.

Implements `docs/planning/model_training_specs.md` M2. The existing
`unified_gbm_baseline.py` runs the same family of models across all three
modalities; this runs the RNase-H arm on its own, which is the only arm whose
`target_gene` column holds real gene symbols, and applies the three fixes the
spec marks as required before retraining.

WHAT THE SPEC ASKED FOR, AND WHY
--------------------------------
1. **Drop sequences that appear in more than one modality.** 106 sequences
   are in both `rnase_h` and `splice_switching`. That is leakage along the
   very axis a modality comparison tests.
2. **Report effective n as unique target genes (339), not rows (159,215).**
   Rows within an experiment are not independent.
3. **Split by gene.** The siRNA arm cannot be split this way at all — its
   `target_gene` column holds the mRNA target site, one per row — which is
   why this script is restricted to RNase-H rather than run on the union.

TWO METRICS, DELIBERATELY BOTH
------------------------------
The spec flags that `unified_gbm_baseline.py` computes one *pooled* Pearson
across all test rows while `invariant_ranker.py` computes a weighted mean of
*per-experiment* Pearsons, and that the two are not comparable — pooled
correlation is inflated by between-experiment variance. Rather than pick one
and quietly drop the other, both are computed and reported side by side, so
the size of that inflation is visible instead of argued about.

The random-guessing top-k baseline is **computed by simulation**, not quoted.
A baseline you assert is not a baseline.

Run: python -m backend.experiments.benchmark.m2_rnase_h_ranker
"""

from __future__ import annotations

import json
import platform
import subprocess
import time
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from scipy.stats import pearsonr

BENCHMARK_DIR = Path(__file__).resolve().parents[2] / "data" / "benchmark"
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "results" / "benchmark"
DATA_PATH = BENCHMARK_DIR / "unified_benchmark.parquet"

SEED = 42
TEST_GENE_FRAC = 0.25
K = 10
MIN_GROUP_SIZE = 5          # experiments smaller than this cannot support top-10
N_BOOTSTRAP = 1000
N_RANDOM_TRIALS = 50

# Verified hyperparameters, from the spec.
PARAMS = dict(
    objective="lambdarank",
    metric="ndcg",
    learning_rate=0.1,
    num_leaves=63,
    min_data_in_leaf=20,
    verbosity=-1,
    seed=SEED,
)
NUM_BOOST_ROUND = 200

ALPH = "ACGU"


def kmer_features(seqs: pd.Series, k: int = 4) -> np.ndarray:
    n = len(seqs)
    X = np.zeros((n, 4**k), dtype=np.float32)
    for i, s in enumerate(seqs):
        row = X[i]
        for j in range(len(s) - k + 1):
            idx = 0
            ok = True
            for ch in s[j : j + k]:
                pos = ALPH.find(ch)
                if pos < 0:
                    ok = False
                    break
                idx = idx * 4 + pos
            if ok:
                row[idx] += 1
        row /= row.sum() + 1e-9
    return X


def build_features(df: pd.DataFrame) -> np.ndarray:
    """4-mer counts plus a chemistry one-hot, per the spec."""
    Xk = kmer_features(df["seq"], 4)
    chem = pd.Categorical(df["chemistry"]).codes
    Xc = np.zeros((len(df), int(chem.max()) + 1), dtype=np.float32)
    Xc[np.arange(len(df)), chem] = 1.0
    return np.hstack([Xk, Xc]).astype(np.float32)


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def _per_experiment_topk(dfte: pd.DataFrame) -> tuple[list[float], list[str]]:
    """Top-k overlap per experiment, with the gene each experiment belongs to.

    The gene is carried through so the bootstrap can resample genes rather
    than experiments — experiments on the same gene are not independent.
    """
    scores, genes = [], []
    for _, gdf in dfte.groupby("grp", sort=False):
        if len(gdf) < MIN_GROUP_SIZE:
            continue
        top_true = set(gdf.nlargest(K, "y").index)
        top_pred = set(gdf.nlargest(K, "pred").index)
        scores.append(len(top_true & top_pred) / K)
        genes.append(gdf["gene"].iloc[0])
    return scores, genes


def _per_experiment_pearson(dfte: pd.DataFrame) -> float:
    """Size-weighted mean of within-experiment Pearsons.

    This is what `invariant_ranker` reports. It answers "can the model rank
    within an experiment", which is the question the product actually asks.
    """
    rs, wts = [], []
    for _, gdf in dfte.groupby("grp", sort=False):
        if len(gdf) < 3 or gdf["y"].nunique() < 2 or gdf["pred"].nunique() < 2:
            continue
        r = pearsonr(gdf["pred"], gdf["y"]).statistic
        if np.isfinite(r):
            rs.append(r)
            wts.append(len(gdf))
    if not rs:
        return float("nan")
    return float(np.average(rs, weights=wts))


def _bootstrap_ci(values: list[float], genes: list[str],
                  rng: np.random.Generator) -> tuple[float, float]:
    """Percentile CI resampling UNIQUE GENES, not rows and not experiments.

    With 339 genes behind 159k rows, a row-level bootstrap would report an
    interval an order of magnitude too narrow.
    """
    if not values:
        return float("nan"), float("nan")
    by_gene: dict[str, list[float]] = {}
    for v, g in zip(values, genes):
        by_gene.setdefault(g, []).append(v)
    keys = list(by_gene)
    means = []
    for _ in range(N_BOOTSTRAP):
        picked = rng.choice(len(keys), size=len(keys), replace=True)
        pool = [v for i in picked for v in by_gene[keys[i]]]
        means.append(float(np.mean(pool)))
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def random_guessing_topk(dfte: pd.DataFrame, rng: np.random.Generator) -> dict:
    """Simulate the top-k a random ranker achieves on these exact groups.

    Computed rather than quoted. With k=10 and groups of varying size the
    expected overlap is k/n per group, so the number depends entirely on the
    group-size distribution of this test split — an asserted constant would
    be wrong for any other split.

    Each trial draws fresh uniform scores. Permuting a constant vector would
    leave every value tied and hand `nlargest` the first k rows in index
    order, which is not random guessing but "take whatever came first".

    50 trials is enough: the per-trial spread is small because each trial
    already averages over ~1,900 experiments, and the reported sd shows
    whether that holds.
    """
    trials = []
    for _ in range(N_RANDOM_TRIALS):
        draw = dfte.assign(pred=rng.random(len(dfte)))
        scores, _ = _per_experiment_topk(draw)
        if scores:
            trials.append(float(np.mean(scores)))
    return {
        "mean": float(np.mean(trials)),
        "sd": float(np.std(trials)),
        "n_trials": N_RANDOM_TRIALS,
    }


def evaluate(name: str, pred: np.ndarray, dfte_base: pd.DataFrame,
             rng: np.random.Generator) -> dict:
    dfte = dfte_base.assign(pred=pred)
    topk, genes = _per_experiment_topk(dfte)
    lo, hi = _bootstrap_ci(topk, genes, rng)
    pooled = float(pearsonr(dfte["pred"], dfte["y"]).statistic)
    per_exp = _per_experiment_pearson(dfte)
    res = {
        f"top{K}": float(np.mean(topk)) if topk else float("nan"),
        f"top{K}_ci95": [lo, hi],
        "pearson_pooled": pooled,
        "pearson_per_experiment": per_exp,
        "n_test_rows": int(len(dfte)),
        "n_test_experiments_scored": len(topk),
        "n_test_genes": int(dfte["gene"].nunique()),
    }
    print(
        f"  {name:<16} top-{K} {res[f'top{K}']:.3f} "
        f"[{lo:.3f}, {hi:.3f}] | Pearson pooled {pooled:.3f} / "
        f"per-exp {per_exp:.3f}"
    )
    return res


# ---------------------------------------------------------------------------

def _git_commit() -> str | None:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], text=True,
            cwd=Path(__file__).resolve().parents[3],
        ).strip()
    except Exception:
        return None


def main() -> None:
    t0 = time.time()
    df = pd.read_parquet(DATA_PATH)
    n_all = len(df)

    # --- fix 1: drop sequences that appear in more than one modality --------
    by_seq = df.groupby("seq")["modality"].nunique()
    multi = set(by_seq[by_seq > 1].index)
    df = df[~df["seq"].isin(multi)]
    print(f"loaded {n_all} rows; dropped {len(multi)} sequences appearing in "
          f"more than one modality ({n_all - len(df)} rows)")

    # --- restrict to the arm whose gene column is real ----------------------
    df = df[df["modality"] == "rnase_h"].reset_index(drop=True)
    n_genes_all = df["target_gene"].nunique()
    print(f"rnase_h arm: {len(df)} rows, {df['experiment_id'].nunique()} "
          f"experiments, {n_genes_all} genes, {df['cell_line'].nunique()} "
          f"cell lines")

    rows_per_gene = len(df) / max(n_genes_all, 1)
    if rows_per_gene < 2.0:
        raise ValueError(
            f"gene split refused: {n_genes_all} genes for {len(df)} rows"
        )

    X = build_features(df)
    y_rank = df["rank_label"].values.astype(np.float32)
    groups = df["experiment_id"].values
    genes = df["target_gene"].values
    print(f"features: {X.shape}")

    # --- fix 3: split by gene ----------------------------------------------
    rng = np.random.default_rng(SEED)
    all_genes = np.unique(genes)
    test_genes = all_genes[
        rng.permutation(len(all_genes))[: int(len(all_genes) * TEST_GENE_FRAC)]
    ]
    tr = ~np.isin(genes, test_genes)
    te = np.isin(genes, test_genes)
    print(f"train {tr.sum()} rows / {len(all_genes) - len(test_genes)} genes | "
          f"test {te.sum()} rows / {len(test_genes)} genes")

    dfte_base = pd.DataFrame(
        {"y": y_rank[te], "grp": groups[te], "gene": genes[te]}
    ).reset_index(drop=True)

    results: dict = {}

    # --- baseline: what does a random ranker get on THESE groups? -----------
    rand = random_guessing_topk(dfte_base, rng)
    results["random_guessing"] = rand
    print(f"  {'random guessing':<16} top-{K} {rand['mean']:.3f} "
          f"(sd {rand['sd']:.3f}, {rand['n_trials']} trials)")

    # --- lambdarank ---------------------------------------------------------
    label = np.ceil(y_rank / 10.0).astype(np.int32)
    order = np.argsort(groups[tr], kind="stable")
    Xtr, ltr = X[tr][order], label[tr][order]
    _, counts = np.unique(groups[tr][order], return_counts=True)
    dtr = lgb.Dataset(Xtr, label=ltr, group=counts)
    m = lgb.train(PARAMS, dtr, num_boost_round=NUM_BOOST_ROUND)
    results["lambdarank-rank"] = evaluate(
        "lambdarank-rank", m.predict(X[te]), dfte_base, rng)

    # --- regression comparators --------------------------------------------
    for name, ytr in (("regress-raw", df["label"].values.astype(np.float32)),
                      ("regress-rank", y_rank)):
        mr = lgb.LGBMRegressor(
            objective="regression", learning_rate=0.1, num_leaves=63,
            min_data_in_leaf=20, n_estimators=NUM_BOOST_ROUND,
            random_state=SEED, verbosity=-1)
        mr.fit(X[tr], ytr[tr])
        results[name] = evaluate(name, mr.predict(X[te]), dfte_base, rng)

    # --- acceptance criterion ----------------------------------------------
    best = max(
        (k for k in results if k != "random_guessing"),
        key=lambda k: results[k][f"top{K}"],
    )
    beats = results[best][f"top{K}_ci95"][0] > rand["mean"]
    results["acceptance"] = {
        "criterion": (
            f"top-{K} materially above computed random guessing "
            f"({rand['mean']:.3f}) under a gene split, judged by whether the "
            f"lower bound of the 95% CI clears it"
        ),
        "best_model": best,
        f"best_top{K}": results[best][f"top{K}"],
        f"best_top{K}_ci95": results[best][f"top{K}_ci95"],
        "random_guessing_top10": rand["mean"],
        "passes": bool(beats),
    }

    results["provenance"] = {
        "spec": "docs/planning/model_training_specs.md M2",
        "data": str(DATA_PATH.name),
        "fixes_applied": [
            f"dropped {len(multi)} sequences present in >1 modality",
            "restricted to modality == rnase_h (the only arm with real gene "
            "symbols in target_gene)",
            "split by target_gene, effective n reported as unique genes",
        ],
        "effective_n_genes": int(n_genes_all),
        "n_rows": int(len(df)),
        "seed": SEED,
        "hyperparameters": {**PARAMS, "num_boost_round": NUM_BOOST_ROUND},
        "git_commit": _git_commit(),
        "versions": {
            "python": platform.python_version(),
            "lightgbm": lgb.__version__,
            "numpy": np.__version__,
            "pandas": pd.__version__,
        },
        "runtime_seconds": round(time.time() - t0, 1),
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUTPUT_DIR / "m2_rnase_h_ranker.json"
    out.write_text(json.dumps(results, indent=2))

    print()
    print(f"acceptance: {'PASS' if beats else 'FAIL'} — best model {best} "
          f"top-{K} {results[best][f'top{K}']:.3f} "
          f"vs random {rand['mean']:.3f}")
    print("NOTE: pooled and per-experiment Pearson are NOT comparable. Pooled "
          "is inflated by between-experiment variance; per-experiment is the "
          "question the product asks.")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
