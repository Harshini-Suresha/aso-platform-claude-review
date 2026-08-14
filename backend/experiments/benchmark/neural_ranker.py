"""Neural chemistry-conditioned pairwise ranker for ASO Atlas.

CPU-first design (Nargis cluster friendly): short 12-28nt sequences, tiny
1D-CNN over one-hot tokens + chemistry embedding + scalar features → MLP
score head, trained with within-table pairwise hinge (weak supervision).

Design choices for the paper's method story:
- Ranking target (within-table pairwise hinge), NOT raw-label regression.
- Chemistry conditioning via learned embedding of the chemistry fingerprint.
- Sequence encoded at nucleotide level (one-hot), no pretrained embeddings
  required → runs on CPU, no GPU/RNA-FM dependency.

CLI (all sizing knobs exposed so it fits short.q/medium.q):
    --data     cleaned ASO Atlas parquet
    --out      output dir
    --n-rows   subsample rows (0 = all)
    --n-pairs  fixed within-table pair budget
    --epochs   epochs
    --batch    batch size
    --device   cpu (default) | mps | cuda

Run (smoke test, ~2 min):
    python -m backend.experiments.benchmark.neural_ranker \
        --data backend/data/benchmark/aso_atlas_clean.parquet \
        --out /tmp/nr_smoke --n-rows 2000 --n-pairs 20000 --epochs 2
"""

from __future__ import annotations

import argparse
import json
import random
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from scipy.stats import pearsonr, spearmanr

ALPH = "ACGU"
MAXLEN = 32
SEED = 42


def encode_onehot(seqs: np.ndarray) -> np.ndarray:
    """(N, MAXLEN, 4) one-hot; zero-padded."""
    X = np.zeros((len(seqs), MAXLEN, 4), dtype=np.float32)
    for i, s in enumerate(seqs):
        for j, ch in enumerate(s):
            if j >= MAXLEN:
                break
            X[i, j, ALPH.index(ch)] = 1.0
    return X


def chemistry_embedding_counts(df: pd.DataFrame) -> tuple[pd.Categorical, int]:
    cat = pd.Categorical(df["chemistry_fingerprint"])
    return cat, cat.categories.size


class ChemConditionedRanker(nn.Module):
    def __init__(self, n_chem: int, d_seq: int = 48, d_chem: int = 16, d_hidden: int = 96):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv1d(4, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool1d(1),
            nn.Flatten(),
            nn.Linear(32, d_seq),
            nn.ReLU(),
        )
        self.chem_emb = nn.Embedding(n_chem, d_chem)
        self.head = nn.Sequential(
            nn.Linear(d_seq + d_chem + 3, d_hidden),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(d_hidden, 1),
        )

    def forward(self, seq: torch.Tensor, chem: torch.Tensor, meta: torch.Tensor) -> torch.Tensor:
        h = self.conv(seq.transpose(1, 2))          # (B, d_seq)
        c = self.chem_emb(chem)                     # (B, d_chem)
        x = torch.cat([h, c, meta], dim=1)
        return self.head(x).squeeze(-1)


def build_pairs(df: pd.DataFrame, rng: np.random.Generator, n_pairs: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Sample within-table pairs (i, j) where rank_label_i > rank_label_j."""
    tables = df.groupby("custom_id", sort=False).indices
    keep_tables = {t: idx for t, idx in tables.items() if len(idx) >= 5}
    pair_i, pair_j = [], []
    for _ in range(n_pairs):
        tidx = keep_tables[rng.choice(list(keep_tables.keys()))]
        if len(tidx) < 2:
            continue
        a, b = rng.choice(len(tidx), size=2, replace=False)
        ia, ib = tidx[a], tidx[b]
        if df["rank_label"].iloc[ia] == df["rank_label"].iloc[ib]:
            continue
        if df["rank_label"].iloc[ia] > df["rank_label"].iloc[ib]:
            pair_i.append(ia); pair_j.append(ib)
        else:
            pair_i.append(ib); pair_j.append(ia)
    return np.array(pair_i, dtype=np.int64), np.array(pair_j, dtype=np.int64)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--n-rows", type=int, default=0)
    ap.add_argument("--n-pairs", type=int, default=800_000)
    ap.add_argument("--epochs", type=int, default=20)
    ap.add_argument("--batch", type=int, default=512)
    ap.add_argument("--device", default="cpu")
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--seed", type=int, default=SEED)
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    rng = np.random.default_rng(args.seed)
    device = torch.device(args.device)
    t0 = time.time()

    df = pd.read_parquet(args.data)
    if args.n_rows and len(df) > args.n_rows:
        df = df.sample(args.n_rows, random_state=args.seed)
    df = df.reset_index(drop=True)
    print(f"[{time.time()-t0:.0f}s] loaded {len(df)} rows, device={args.device}")

    # gene-level split for honest evaluation
    genes = df["target_gene"].values
    all_genes = np.unique(genes)
    test_genes = set(all_genes[rng.permutation(len(all_genes))[: int(len(all_genes) * 0.25)]])
    tr = ~np.isin(genes, list(test_genes))
    te = np.isin(genes, list(test_genes))
    print(f"train {tr.sum()}, test {te.sum()}")

    # build features on the FULL frame once
    seqs = df["aseq"].values.astype(str)
    Xseq = encode_onehot(seqs)
    chem_cat = pd.Categorical(df["chemistry_fingerprint"])
    chem_codes = chem_cat.codes.astype(np.int64)
    meta = np.column_stack(
        [
            np.log1p(seqs_char_len := np.array([len(s) for s in seqs])),
            np.array([(s.count("G") + s.count("C")) / len(s) for s in seqs]),
            np.log1p(df["dosage"].fillna(4000).values),
        ]
    ).astype(np.float32)

    pi, pj = build_pairs(df, rng, args.n_pairs)
    # restrict pairs to train rows (test tables must be unseen)
    keep = tr[pi] & tr[pj]
    pi, pj = pi[keep], pj[keep]
    print(f"[{time.time()-t0:.0f}s] {len(pi)} train pairs")

    model = ChemConditionedRanker(n_chem=chem_cat.categories.size)
    model.to(device)
    opt = torch.optim.Adam(model.parameters(), lr=args.lr)
    loss_fn = nn.MarginRankingLoss(margin=1.0)

    def score_for(idx: np.ndarray) -> torch.Tensor:
        s = torch.from_numpy(Xseq[idx]).to(device)
        c = torch.from_numpy(chem_codes[idx]).to(device)
        m = torch.from_numpy(meta[idx]).to(device)
        return model(s, c, m)

    for epoch in range(args.epochs):
        model.train()
        order = rng.permutation(len(pi))
        tot, nb = 0.0, 0
        for b in range(0, len(pi), args.batch):
            bsel = order[b : b + args.batch]
            s1 = score_for(pi[bsel])
            s2 = score_for(pj[bsel])
            y = torch.ones(s1.shape[0], device=device)
            loss = loss_fn(s1, s2, y)
            opt.zero_grad()
            loss.backward()
            opt.step()
            tot += loss.item()
            nb += 1
        print(f"  epoch {epoch+1}/{args.epochs} loss {tot/max(nb,1):.4f} ({time.time()-t0:.0f}s)")

    # eval: within-table Spearman + top-10 overlap on held-out genes
    model.eval()
    with torch.no_grad():
        pred = torch.zeros(len(df), device=device)
        for b in range(0, len(df), 2048):
            s = torch.from_numpy(Xseq[b : b + 2048]).to(device)
            c = torch.from_numpy(chem_codes[b : b + 2048]).to(device)
            m = torch.from_numpy(meta[b : b + 2048]).to(device)
            pred[b : b + 2048] = model(s, c, m)
    pred = pred.cpu().numpy()
    y_rank = df["rank_label"].values

    K = 10
    rhos, wts, topk = [], [], []
    ev = pd.DataFrame({"pred": pred, "y": y_rank, "grp": df["custom_id"].values})[te]
    for _, g in ev.groupby("grp"):
        if len(g) < 5:
            continue
        r = spearmanr(g["pred"], g["y"]).statistic
        if np.isnan(r):
            continue
        rhos.append(r); wts.append(len(g))
        topk.append(len(set(g.nlargest(K, "y").index) & set(g.nlargest(K, "pred").index)) / K)
    metrics = {
        "spearman": float(np.average(rhos, weights=wts)),
        "top10": float(np.mean(topk)),
        "pearson": float(pearsonr(pred[te], y_rank[te]).statistic),
        "n_test": int(te.sum()),
        "n_train": int(tr.sum()),
        "n_pairs": int(len(pi)),
        "device": args.device,
    }
    print(f"within-table Spearman {metrics['spearman']:.3f} | top-10 {metrics['top10']:.3f} | Pearson {metrics['pearson']:.3f}")

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "metrics.json").write_text(json.dumps(metrics, indent=2))
    torch.save(model.state_dict(), args.out / "model.pt")
    pd.DataFrame({"pred": pred, "rank_label": y_rank, "gene": df["target_gene"].values}).to_csv(
        args.out / "predictions.csv", index=False
    )
    print(f"wrote {args.out} in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
