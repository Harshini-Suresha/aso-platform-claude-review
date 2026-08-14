"""GBM (LightGBM LambdaRank) ceiling on the UNIFIED 3-modality benchmark.

Establishes the honest gene-split ceiling for the neural ranker: if a strong
tree ranker also tops out around top-10 ~0.3 / Pearson ~0.2, then the
unified-data cross-gene signal is fundamentally weak and the generative
pipeline's null acceptance result reflects the ceiling, not an implementation
bug. Reuses the same protocol as aso_rank_vs_regress.py but on the unified
schema (seq / chemistry / experiment_id / target_gene / rank_label).

Run: python -m backend.experiments.benchmark.unified_gbm_baseline
"""

from __future__ import annotations

import json
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

ALPH = "ACGU"


def kmer_features(seqs: pd.Series, k: int = 4) -> np.ndarray:
    n = len(seqs)
    X = np.zeros((n, 4**k), dtype=np.float32)
    for i, s in enumerate(seqs):
        row = X[i]
        for j in range(len(s) - k + 1):
            idx = 0
            for ch in s[j : j + k]:
                idx = idx * 4 + ALPH.index(ch)
            row[idx] += 1
        row /= row.sum() + 1e-9
    return X


def build_features(df: pd.DataFrame) -> np.ndarray:
    Xk = kmer_features(df["seq"], 4)
    chem = pd.Categorical(df["chemistry"]).codes
    Xc = np.zeros((len(df), chem.max() + 1), dtype=np.float32)
    Xc[np.arange(len(df)), chem] = 1.0
    gc = df["seq"].apply(lambda s: (s.count("G") + s.count("C")) / len(s))
    Xm = np.column_stack(
        [np.log1p(df["seq"].str.len().values), gc.values]
    ).astype(np.float32)
    return np.hstack([Xk, Xc, Xm]).astype(np.float32)


def evaluate(name: str, pred: np.ndarray, mask: np.ndarray,
             groups: np.ndarray, y_rank: np.ndarray) -> dict:
    dfte = pd.DataFrame({"pred": pred, "y": y_rank, "grp": groups})[mask]
    topk_j, wts = [], []
    for _, gdf in dfte.groupby("grp"):
        if len(gdf) < 5:
            continue
        top_true = set(gdf.nlargest(K, "y").index)
        top_pred = set(gdf.nlargest(K, "pred").index)
        topk_j.append(len(top_true & top_pred) / K)
        wts.append(len(gdf))
    res = {
        f"top{K}": float(np.mean(topk_j)) if topk_j else float("nan"),
        "pearson": float(pearsonr(pred[mask], y_rank[mask]).statistic),
        "n_test": int(mask.sum()),
    }
    print(
        f"  {name:<16} top-{K} {res[f'top{K}']:.3f} | "
        f"Pearson {res['pearson']:.3f} | n_test {res['n_test']}"
    )
    return res


def main() -> None:
    df = pd.read_parquet(DATA_PATH)
    X = build_features(df)
    y_rank = df["rank_label"].values.astype(np.float32)
    groups = df["experiment_id"].values
    genes = df["target_gene"].values
    print(f"loaded {len(df)} rows, X={X.shape}")

    rng = np.random.default_rng(SEED)
    all_genes = np.unique(genes)
    test_genes = all_genes[rng.permutation(len(all_genes))[: int(len(all_genes) * TEST_GENE_FRAC)]]
    tr = ~np.isin(genes, test_genes)
    te = np.isin(genes, test_genes)
    print(f"train {tr.sum()}, test {te.sum()}, test genes {len(test_genes)}")

    results: dict = {}

    label = np.ceil(y_rank / 10.0).astype(np.int32)
    inv = np.unique(groups[tr], return_inverse=True)[1]
    dtr = lgb.Dataset(X[tr], label=label[tr], group=np.bincount(inv))
    params = dict(
        objective="lambdarank", metric="ndcg", learning_rate=0.1,
        num_leaves=63, min_data_in_leaf=20, verbosity=-1, seed=SEED,
    )
    m = lgb.train(params, dtr, num_boost_round=200)
    results["lambdarank-rank"] = evaluate(
        "lambdarank-rank", m.predict(X), te, groups, y_rank)

    for name, ytr in (("regress-raw", df["label"].values.astype(np.float32)),
                      ("regress-rank", y_rank)):
        mr = lgb.LGBMRegressor(
            objective="regression", learning_rate=0.1, num_leaves=63,
            min_data_in_leaf=20, seed=SEED, verbosity=-1)
        mr.fit(X[tr], ytr[tr])
        results[name] = evaluate(name, mr.predict(X), te, groups, y_rank)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUTPUT_DIR / "unified_gbm_baseline.json"
    out.write_text(json.dumps(results, indent=2))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
