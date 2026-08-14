"""De-risk experiment: ranking weak supervision vs regression on noisy labels.

Question: does learning to RANK (within patent table) beat learning to REGRESS
raw inhibition% on the noisy ASO Atlas patent labels?

Models (all CPU, LightGBM):
  A) Regression on clipped inhibition_percent  (OligoAI-style absolute regression)
  B) Regression on rank_label                   (surrogate)
  C) LambdaRank on raw label, group=patent table
  D) LambdaRank on rank_label, group=patent table

Protocol:
  - Gene-level split (75% genes train / 25% genes test) — honest, no leakage.
  - Rank within each test patent table; evaluate
      * within-table Spearman (predicted vs rank_label)
      * top-10 overlap (mean Jaccard of predicted top-10 vs true top-10)
      * global Pearson on rank_label

Run: python -m backend.experiments.benchmark.aso_rank_vs_regress
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from scipy.stats import pearsonr, spearmanr

BENCHMARK_DIR = Path(__file__).resolve().parents[2] / "data" / "benchmark"
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "results" / "benchmark"
DATA_PATH = BENCHMARK_DIR / "aso_atlas_clean.parquet"

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
    Xk = kmer_features(df["aseq"], 4)
    chem = pd.Categorical(df["chemistry_fingerprint"]).codes
    Xc = np.zeros((len(df), chem.max() + 1), dtype=np.float32)
    Xc[np.arange(len(df)), chem] = 1.0
    Xm = np.column_stack(
        [
            np.log1p(df["aseq"].str.len().values),
            df["aseq"].apply(lambda s: (s.count("G") + s.count("C")) / len(s)).values,
            np.log1p(df["dosage"].fillna(4000).values),
        ]
    ).astype(np.float32)
    return np.hstack([Xk, Xc, Xm]).astype(np.float32)


def evaluate(name: str, pred: np.ndarray, mask: np.ndarray, groups: np.ndarray, y_rank: np.ndarray) -> dict:
    dfte = pd.DataFrame({"pred": pred, "y": y_rank, "grp": groups})[mask]
    rhos, wts, topk_j = [], [], []
    for _, gdf in dfte.groupby("grp"):
        if len(gdf) < 5:
            continue
        rho = spearmanr(gdf["pred"], gdf["y"]).statistic
        if np.isnan(rho):
            continue
        rhos.append(rho)
        wts.append(len(gdf))
        top_true = set(gdf.nlargest(K, "y").index)
        top_pred = set(gdf.nlargest(K, "pred").index)
        topk_j.append(len(top_true & top_pred) / K)
    res = {
        "spearman": float(np.average(rhos, weights=wts)) if wts else float("nan"),
        f"top{K}": float(np.mean(topk_j)) if topk_j else float("nan"),
        "pearson": float(pearsonr(pred[mask], y_rank[mask]).statistic),
        "n_test": int(mask.sum()),
    }
    print(
        f"  {name:<16} Spearman {res['spearman']:.3f} | "
        f"top-{K} {res[f'top{K}']:.3f} | Pearson {res['pearson']:.3f}"
    )
    return res


def main() -> None:
    t0 = time.time()
    df = pd.read_parquet(DATA_PATH)
    X = build_features(df)
    y_raw = df["inhibition_percent"].values.astype(np.float32)
    y_rank = df["rank_label"].values.astype(np.float32)
    groups = df["custom_id"].values
    genes = df["target_gene"].values
    print(f"loaded {len(df)} rows, X={X.shape} ({time.time()-t0:.0f}s)")

    rng = np.random.default_rng(SEED)
    all_genes = np.unique(genes)
    test_genes = all_genes[rng.permutation(len(all_genes))[: int(len(all_genes) * TEST_GENE_FRAC)]]
    tr = ~np.isin(genes, test_genes)
    te = np.isin(genes, test_genes)
    print(f"train {tr.sum()}, test {te.sum()}, test genes {len(test_genes)}")

    results: dict = {}

    def run_regression(name: str, ytr: np.ndarray) -> None:
        m = lgb.LGBMRegressor(objective="regression", learning_rate=0.1, num_leaves=63, min_data_in_leaf=20, seed=SEED, verbosity=-1)
        m.fit(X[tr], ytr[tr])
        results[name] = evaluate(name, m.predict(X), te, groups, y_rank)

    def run_ranker(name: str, ytr: np.ndarray) -> None:
        # LambdaRank needs integer relevance grades; discretize continuous
        # labels into deciles (within-table rank is scale-invariant).
        label = np.ceil(ytr / 10.0).astype(np.int32)
        inv = np.unique(groups[tr], return_inverse=True)[1]
        dtr = lgb.Dataset(X[tr], label=label[tr], group=np.bincount(inv))
        params = dict(
            objective="lambdarank",
            metric="ndcg",
            learning_rate=0.1,
            num_leaves=63,
            min_data_in_leaf=20,
            verbosity=-1,
            seed=SEED,
        )
        m = lgb.train(params, dtr, num_boost_round=200)
        results[name] = evaluate(name, m.predict(X), te, groups, y_rank)

    run_regression("regress-raw", y_raw)
    run_regression("regress-rank", y_rank)
    run_ranker("lambdarank-raw", y_raw)
    run_ranker("lambdarank-rank", y_rank)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUTPUT_DIR / "aso_rank_vs_regress.json"
    out.write_text(json.dumps(results, indent=2))
    print(f"\nwrote {out} in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
