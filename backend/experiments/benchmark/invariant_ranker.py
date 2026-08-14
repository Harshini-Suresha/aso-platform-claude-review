"""Chemistry-invariant ranking model — the method centerpiece.

Goal: learn a sequence-activity RANKING that generalizes across chemistry
and modality, from within-experiment weak-supervision labels.

Architecture (all CPU-trainable):
    seq (one-hot, len<=MAX_LEN) -> Conv1D stack -> global max pool -> z
    score = MLP(z)                                   [seqonly / invariant]
    score = MLP([z, chem_embedding])                 [conditioned]
    invariant adds:  chem_class = MLP(GRL(z))        (adversarial)

Three model modes, one eval protocol:
  * seqonly     : sequence only, no chemistry. Baseline.
  * conditioned : chemistry embedding fed to the ranking head. The "naive"
                  chemistry-aware model (OligoAI-style conditioning).
  * invariant   : domain-adversarial (gradient reversal on a chemistry
                  classifier) so the representation z is made INVARIANT to
                  chemistry. No chemistry input at inference.

Training: pairwise MarginRankingLoss within experiment groups (patent
tables / siRBench source|cell_line). Eval per experiment: within-group
Spearman, top-k overlap, Pearson vs within-group z-score.

Splits:
  --split random|gene         train/test experiments (random or by gene)
  --holdout_chemistry C       train on all experiments whose chemistry != C
  --train_modality/--eval_modality M   cross-modality transfer

CLI:
    python -m backend.experiments.benchmark.invariant_ranker --data <pq> \
        --mode invariant --split random --epochs 25 --smoke ...
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
import torch.nn.functional as F

torch.manual_seed(0)
np.random.seed(0)
random.seed(0)

NUCLEOTIDES = "ACGU"
MAX_LEN = 40
MIN_EXP_ROWS = 10
BEST_TOP_K = 10


class GradientReversal(torch.autograd.Function):
    @staticmethod
    def forward(ctx, x, alpha):
        ctx.alpha = alpha
        return x.clone()

    @staticmethod
    def backward(ctx, grad_output):
        return -ctx.alpha * grad_output, None


def seq_to_onehot(seqs: list[str], max_len: int = MAX_LEN) -> np.ndarray:
    sa = np.array(seqs, dtype="<U%d" % max_len)
    codes = sa.view(np.uint32).reshape(len(sa), max_len)
    lut = np.zeros(128, dtype=np.int64) - 1
    for i, c in enumerate(NUCLEOTIDES):
        lut[ord(c)] = i
    idx = lut[codes]  # (n, max_len), -1 where not A/C/G/U
    out = np.zeros((len(sa), max_len, len(NUCLEOTIDES)), dtype=np.float32)
    m = idx >= 0
    i, j = np.where(m)
    out[i, j, idx[i, j]] = 1.0
    return out


class SeqEncoder(nn.Module):
    def __init__(self, d: int = 128):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv1d(len(NUCLEOTIDES), d, 5, padding=2),
            nn.ReLU(),
            nn.Conv1d(d, d, 5, padding=2),
            nn.ReLU(),
            nn.Conv1d(d, d, 3, padding=1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:  # (B,L,4)
        x = x.transpose(1, 2)  # (B,4,L)
        h = self.conv(x)
        return h.max(dim=2).values  # (B,d)


class RankHead(nn.Module):
    def __init__(self, in_d: int, hidden: int = 128):
        super().__init__()
        self.mlp = nn.Sequential(
            nn.Linear(in_d, hidden), nn.ReLU(),
            nn.Linear(hidden, hidden), nn.ReLU(),
            nn.Linear(hidden, 1),
        )

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        return self.mlp(z).squeeze(-1)


class ChemClassifier(nn.Module):
    def __init__(self, in_d: int, n_chem: int, hidden: int = 64):
        super().__init__()
        self.mlp = nn.Sequential(
            nn.Linear(in_d, hidden), nn.ReLU(), nn.Linear(hidden, n_chem)
        )

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        return self.mlp(z)


class InvariantRanker(nn.Module):
    def __init__(self, mode: str, n_chem: int, d: int = 128,
                 chem_emb_d: int = 64):
        super().__init__()
        assert mode in ("seqonly", "conditioned", "invariant")
        self.mode = mode
        self.encoder = SeqEncoder(d)
        self.chem_emb = nn.Embedding(n_chem, chem_emb_d)
        head_in = d + (chem_emb_d if mode == "conditioned" else 0)
        self.head = RankHead(head_in)
        self.chem_cls = ChemClassifier(d, n_chem) if mode == "invariant" else None

    def encode(self, seq_oh: torch.Tensor) -> torch.Tensor:
        return self.encoder(seq_oh)

    def score(self, seq_oh: torch.Tensor,
              chem: torch.Tensor | None = None) -> torch.Tensor:
        z = self.encode(seq_oh)
        if self.mode == "conditioned":
            z = torch.cat([z, self.chem_emb(chem)], dim=1)
        return self.head(z)

    def chem_logits(self, seq_oh: torch.Tensor) -> torch.Tensor | None:
        if self.chem_cls is None:
            return None
        z = GradientReversal.apply(self.encode(seq_oh), 1.0)
        return self.chem_cls(z)


def build_vocab(df: pd.DataFrame) -> dict[str, int]:
    return {c: i for i, c in enumerate(sorted(df["chemistry"].unique()))}


def split_experiments(df: pd.DataFrame, split: str,
                      gene_split_genes: set[str] | None = None):
    exps = sorted(df["experiment_id"].unique())
    if split == "random":
        rng = np.random.default_rng(0)
        rng.shuffle(exps)
        n = int(len(exps) * 0.75)
        return set(exps[:n]), set(exps[n:])
    if split == "gene":
        genes = sorted(df["target_gene"].unique())
        rng = np.random.default_rng(0)
        rng.shuffle(genes)
        n = int(len(genes) * 0.75)
        train_genes = set(genes[:n])
        train_exp = set(df.loc[df["target_gene"].isin(train_genes), "experiment_id"])
        test_exp = set(exps) - train_exp
        return train_exp, test_exp
    raise ValueError(split)


def make_batches(df: pd.DataFrame, train_exp: set[str], pairs_per_exp: int,
                 n_epochs: int, rng: np.random.Generator,
                 chem_id_arr: np.ndarray, full_oh: np.ndarray):
    """Yield (seq_oh_a, seq_oh_b, chem_a, chem_b, sign) tensors per epoch."""
    exp_rows = df.groupby("experiment_id")["label"].indices
    exp_rows = {e: idx for e, idx in exp_rows.items() if e in train_exp}
    rank_arr = df["rank_label"].to_numpy()
    for _ in range(n_epochs):
        exps = list(exp_rows.keys())
        rng.shuffle(exps)
        batches = []
        for e in exps:
            idx = exp_rows[e]
            m = len(idx)
            if m < 2:
                continue
            n_pairs = min(pairs_per_exp, m * (m - 1) // 2)
            a = rng.integers(0, m, n_pairs)
            b = (a + rng.integers(1, m, n_pairs)) % m
            a_i, b_i = idx[a], idx[b]
            s = rank_arr[a_i]
            t = rank_arr[b_i]
            sign = np.where(s >= t, 1.0, -1.0)
            batches.append((
                torch.from_numpy(full_oh[a_i]),
                torch.from_numpy(full_oh[b_i]),
                torch.from_numpy(chem_id_arr[a_i]),
                torch.from_numpy(chem_id_arr[b_i]),
                torch.from_numpy(sign.astype(np.float32)),
            ))
        yield batches


def _wilson_interval(n_hits: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Two-sided Wilson score interval for a coverage proportion.

    Correct even for the tiny conformal groups (n ~ 6-23) seen for the
    scarce mechanisms, where a normal approximation is invalid.
    """
    if n == 0:
        return float("nan"), float("nan")
    p = n_hits / n
    denom = 1.0 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return float(max(0.0, centre - half)), float(min(1.0, centre + half))


def _bootstrap_ci(values: list[float], stat: str = "mean",
                  n_boot: int = 10000, alpha: float = 0.1) -> tuple[float, float]:
    """Percentile bootstrap CI for the selected-size summary."""
    if not values:
        return float("nan"), float("nan")
    rng = np.random.default_rng(0)
    arr = np.asarray(values, dtype=float)
    draws = []
    for _ in range(n_boot):
        b = rng.choice(arr, size=len(arr), replace=True)
        draws.append(float(b.mean() if stat == "mean" else np.median(b)))
    lo, hi = np.quantile(draws, [alpha / 2, 1 - alpha / 2])
    return float(lo), float(hi)


def conformal_topk(group_scores, group_true_topk, group_sizes, k: int,
                   alpha: float = 0.1, weights: dict | None = None) -> dict:
    """Split-conformal selection of top-k per experiment.

    Nonconformity per group: the predicted score of the *weakest* true
    top-k member (tau_g = min over true-top-k of s_i). The selected set at
    threshold q is {i: s_i >= q}. Calibration computes the (1-alpha)
    quantile of tau_g; the guarantee P(selected ⊇ true top-k) >= 1-alpha
    holds under exchangeability, and under covariate shift when a likelihood
    ratio weight is supplied (weighted conformal, Tibshirani et al. 2019).

    group_scores    : dict exp_id -> np.array of scores
    group_true_topk : dict exp_id -> bool mask (True = in true top-k)
    group_sizes     : dict exp_id -> group size
    weights         : dict exp_id -> density-ratio weight (weighted version)
    """
    exps = sorted(group_scores.keys())
    if len(exps) < 4:
        return {"coverage": float("nan"), "selected_size": float("nan"),
                "n_groups": int(len(exps))}
    n_cal = len(exps) // 2
    cal, test = exps[:n_cal], exps[n_cal:]

    taus = np.array([group_scores[e][group_true_topk[e]].min()
                     for e in cal])
    w = np.ones(len(cal)) if weights is None else np.array(
        [weights.get(e, 1.0) for e in cal])
    w = w / w.sum()

    order = np.argsort(taus)
    cum = np.cumsum(w[order])
    idx = np.searchsorted(cum, 1.0 - alpha)
    idx = min(idx, len(order) - 1)
    q_hat = taus[order[idx]]

    covs, sizes = [], []
    for e in test:
        s = group_scores[e]
        selected = s >= q_hat
        covs.append(bool((group_true_topk[e] & selected).sum()
                         == group_true_topk[e].sum()))
        sizes.append(int(selected.sum()))
    cov_lo, cov_hi = _wilson_interval(sum(covs), len(covs))
    size_lo, size_hi = _bootstrap_ci(sizes, "mean")
    med_lo, med_hi = _bootstrap_ci(sizes, "median")
    return {
        "coverage": float(np.mean(covs)),
        "coverage_ci": [cov_lo, cov_hi],
        "selected_size_mean": float(np.mean(sizes)),
        "selected_size_mean_ci": [size_lo, size_hi],
        "selected_size_median": float(np.median(sizes)),
        "selected_size_median_ci": [med_lo, med_hi],
        "k": int(k),
        "alpha": float(alpha),
        "n_groups": int(len(test)),
        "q_hat": float(q_hat),
        "weighted": weights is not None,
    }


def save_checkpoint(model: InvariantRanker, mode: str, d: int,
                    chem_vocab: dict[str, int],
                    train_chem_set: set[str], path: Path) -> None:
    torch.save({
        "mode": mode, "d": d,
        "n_chem": len(chem_vocab),
        "chem_vocab": chem_vocab,
        "train_chem_set": sorted(train_chem_set),
        "model_state": model.state_dict(),
    }, path)


def load_scorer(path: Path) -> tuple[InvariantRanker, dict[str, int], str]:
    ck = torch.load(path, map_location="cpu", weights_only=False)
    model = InvariantRanker(ck["mode"], ck["n_chem"], d=ck["d"])
    model.load_state_dict(ck["model_state"])
    model.eval()
    return model, ck["chem_vocab"], ck["mode"]


def score_df(model: InvariantRanker, chem_vocab: dict[str, int],
             df: pd.DataFrame) -> np.ndarray:
    """Score sequences in ``df`` (must have ``seq``; ``chemistry`` optional).

    Chemistry OOV (unseen at training) falls back to the mean embedding over
    seen chemistries, mirroring the holdout-chemistry eval in ``run``.
    """
    oh = torch.from_numpy(seq_to_onehot(df["seq"].tolist()))
    if model.mode == "conditioned":
        seen = set(chem_vocab)
        if len(model.chem_emb.weight) == len(chem_vocab) and not set(df["chemistry"]) <= seen:
            ext = nn.Embedding(len(chem_vocab) + 1, model.chem_emb.embedding_dim)
            ext.weight.data[:-1] = model.chem_emb.weight.data
            train_ids = [chem_vocab[c] for c in df["chemistry"] if c in seen]
            if train_ids:
                mean = model.chem_emb.weight[train_ids].mean(dim=0)
            else:
                mean = model.chem_emb.weight.data.mean(dim=0)
            ext.weight.data[-1] = mean
            model.chem_emb = ext
        oov = len(chem_vocab)
        ids = torch.tensor([chem_vocab.get(c, oov) for c in df["chemistry"]])
        scores = model.score(oh, ids)
    else:
        scores = model.score(oh)
    return scores.detach().numpy()


def _ranks(x: np.ndarray) -> np.ndarray:
    order = np.argsort(x, kind="mergesort")
    ranks = np.empty(len(x), dtype=np.float64)
    ranks[order] = np.arange(len(x))
    return ranks


def run(df: pd.DataFrame, mode: str, train_exp: set, test_exp: set,
        chem_vocab: dict[str, int], out: Path, epochs: int = 25,
        d: int = 128, pairs_per_exp: int = 64, lr: float = 1e-3,
        smoke: bool = False, use_oov_mean: bool = False,
        save_path: Path | None = None) -> dict:
    df = df.reset_index(drop=True)
    device = torch.device("cpu")
    model = InvariantRanker(mode, len(chem_vocab), d=d)
    model.to(device)
    opt = torch.optim.Adam(model.parameters(), lr=lr)

    n_epochs = 3 if smoke else epochs
    rng = np.random.default_rng(0)
    chem_ids = {c: chem_vocab[c] for c in chem_vocab}
    chem_list = df["chemistry"].tolist()
    chem_id_arr = np.array([chem_ids[c] for c in chem_list])
    train_chem_set = set(df.loc[df["experiment_id"].isin(train_exp),
                                "chemistry"])
    labels = df["rank_label"].to_numpy()
    seq_list = df["seq"].tolist()
    full_oh = seq_to_onehot(seq_list)

    t0 = time.time()
    for ep in range(n_epochs):
        model.train()
        total_loss = 0.0
        n_b = 0
        buf = []
        for batches in make_batches(df, train_exp, pairs_per_exp, 1, rng,
                                    chem_id_arr, full_oh):
            for (a_oh, b_oh, a_c, b_c, sign) in batches:
                buf.append((a_oh, b_oh, a_c, b_c, sign))
                if sum(x[0].shape[0] for x in buf) < 768:
                    continue
                a_oh, b_oh, a_c, b_c, sign = map(
                    lambda i: torch.cat([x[i] for x in buf], dim=0),
                    range(5))
                opt.zero_grad()
                sa = model.score(a_oh, a_c)
                sb = model.score(b_oh, b_c)
                rank_loss = F.margin_ranking_loss(sa, sb, sign, margin=0.5)
                loss = rank_loss
                if mode == "invariant":
                    ca = model.chem_logits(a_oh)
                    cb = model.chem_logits(b_oh)
                    adv = (F.cross_entropy(ca, a_c) + F.cross_entropy(cb, b_c)) * 0.5
                    loss = rank_loss + 0.3 * adv
                loss.backward()
                opt.step()
                total_loss += rank_loss.item()
                n_b += 1
                buf = []
                if smoke and n_b >= 12:
                    break
            if smoke and n_b >= 12:
                break
        if buf:
            a_oh, b_oh, a_c, b_c, sign = map(
                lambda i: torch.cat([x[i] for x in buf], dim=0),
                range(5))
            opt.zero_grad()
            sa = model.score(a_oh, a_c)
            sb = model.score(b_oh, b_c)
            rank_loss = F.margin_ranking_loss(sa, sb, sign, margin=0.5)
            loss = rank_loss
            if mode == "invariant":
                ca = model.chem_logits(a_oh)
                cb = model.chem_logits(b_oh)
                adv = (F.cross_entropy(ca, a_c) + F.cross_entropy(cb, b_c)) * 0.5
                loss = rank_loss + 0.3 * adv
            loss.backward()
            opt.step()
            total_loss += rank_loss.item()
            n_b += 1
        print(f"  epoch {ep+1}/{n_epochs} loss {total_loss/max(n_b,1):.4f} "
              f"({time.time()-t0:.0f}s)", flush=True)

    # ---- eval ----
    model.eval()
    oov_id = None
    if mode == "conditioned" and use_oov_mean:
        oov_id = len(chem_vocab)
        new_emb = nn.Embedding(len(chem_vocab) + 1, model.chem_emb.embedding_dim)
        new_emb.weight.data[:-1] = model.chem_emb.weight.data
        ids = torch.tensor([chem_ids[c] for c in sorted(train_chem_set)])
        new_emb.weight.data[-1] = model.chem_emb.weight[ids].mean(dim=0)
        model.chem_emb = new_emb
    test_rows = df[df["experiment_id"].isin(test_exp)]
    test_groups = test_rows.groupby("experiment_id", sort=False)
    spears, topk, pears, sizes = [], [], [], []
    with torch.no_grad():
        for e, g in test_groups:
            if len(g) < 2:
                continue
            oh = torch.from_numpy(seq_to_onehot(g["seq"].tolist()))
            cids = torch.from_numpy(chem_id_arr[g.index.to_numpy()])
            if mode == "conditioned":
                if oov_id is not None:
                    unseen = ~g["chemistry"].isin(train_chem_set)
                    cids = cids.clone()
                    cids[unseen.to_numpy()] = oov_id
                scores = model.score(oh, cids)
            else:
                scores = model.score(oh)
            pred = scores.numpy()
            y = g["rank_label"].to_numpy()
            if len(pred) >= 2 and np.std(pred) > 0 and np.std(y) > 0:
                rho = np.corrcoef(_ranks(pred), _ranks(y))[0, 1]
                pear = np.corrcoef(pred, g["label_z"].to_numpy())[0, 1]
            else:
                rho, pear = np.nan, np.nan
            if len(pred) >= 2:
                topk_mask = np.zeros(len(pred), dtype=bool)
                k = min(BEST_TOP_K, len(pred))
                topk_mask[np.argsort(y)[-k:]] = True
                pred_mask = np.zeros(len(pred), dtype=bool)
                pred_mask[np.argsort(pred)[-k:]] = True
                ov = float(np.mean(topk_mask & pred_mask)) / float(k) * 100.0
            else:
                ov = np.nan
            spears.append(rho); topk.append(ov); pears.append(pear)
            sizes.append(len(pred))

    # weighted averages by experiment size
    def wmean(v, m=None):
        v = np.array(v); m = np.array(sizes) if m is None else m
        mask = ~np.isnan(v)
        if mask.sum() == 0:
            return float("nan")
        return float(np.average(v[mask], weights=m[mask]))

    res = {
        "mode": mode,
        "n_test_experiments": int(len(spears)),
        "n_test_rows": int(len(test_rows)),
        "spearman_w": wmean(spears),
        "topk_w": wmean(topk),
        "pearson_z_w": wmean(pears),
        "median_exp_size": int(np.median(sizes)),
        "train_seconds": round(time.time() - t0, 1),
    }
    if save_path is not None:
        save_checkpoint(model, mode, d, chem_vocab, train_chem_set, save_path)
        res["checkpoint"] = str(save_path)
    return res


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, type=Path)
    ap.add_argument("--mode", default="invariant",
                    choices=["seqonly", "conditioned", "invariant"])
    ap.add_argument("--split", default="random", choices=["random", "gene"])
    ap.add_argument("--holdout_chemistry", default=None,
                    help="train excludes all experiments with this chemistry")
    ap.add_argument("--train_modality", default=None)
    ap.add_argument("--eval_modality", default=None)
    ap.add_argument("--epochs", type=int, default=25)
    ap.add_argument("--d", type=int, default=128)
    ap.add_argument("--pairs_per_exp", type=int, default=64)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--save_model", default=None, type=Path,
                    help="save a ranker checkpoint usable by generative_design")
    ap.add_argument("--outdir", required=True, type=Path)
    args = ap.parse_args()

    df = pd.read_parquet(args.data)
    if args.smoke:
        exps = sorted(df["experiment_id"].unique())
        rng = np.random.default_rng(0)
        keep = set(rng.choice(exps, 60, replace=False))
        df = df[df["experiment_id"].isin(keep)].copy()

    if args.holdout_chemistry:
        keep = df["chemistry"] != args.holdout_chemistry
        train_rows = df[keep]
        test_rows = df[~keep]
        train_exp = set(train_rows["experiment_id"])
        test_exp = set(test_rows["experiment_id"])
    elif args.train_modality:
        train_exp = set(df.loc[df["modality"] == args.train_modality,
                               "experiment_id"])
        test_exp = set(df.loc[df["modality"] == args.eval_modality,
                              "experiment_id"])
    else:
        train_exp, test_exp = split_experiments(df, args.split)

    chem_vocab = {c: i for i, c in enumerate(sorted(df["chemistry"].unique()))}

    args.outdir.mkdir(parents=True, exist_ok=True)
    res = run(df, args.mode, train_exp, test_exp, chem_vocab,
              args.outdir, epochs=args.epochs, d=args.d,
              pairs_per_exp=args.pairs_per_exp, lr=args.lr,
              smoke=args.smoke,
              use_oov_mean=bool(args.holdout_chemistry),
              save_path=args.save_model)
    res.update({"split": args.split, "holdout_chemistry": args.holdout_chemistry,
                "train_modality": args.train_modality,
                "eval_modality": args.eval_modality,
                "epochs": args.epochs})
    out_f = args.outdir / "result.json"
    out_f.write_text(json.dumps(res, indent=2))
    print(json.dumps(res, indent=2))
    print(f"wrote {out_f}")


if __name__ == "__main__":
    main()
