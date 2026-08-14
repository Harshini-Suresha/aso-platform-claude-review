"""Mechanism-conditioned generative design — the method centerpiece.

CVAE over RNA oligo sequences, conditioned on (mechanism, chemistry), with
ranking-aware training from within-experiment weak-supervision labels. The
generator is the first stage of a generate -> rank -> calibrated-accept
pipeline; the acceptance stage reuses ``invariant_ranker``.

Novelty (locked 2026-08-12, see docs/iclr_benchmark_plan.md):
* Mechanism is a CONTROLLABLE conditioning axis (re-conditioning: encode a
  sequence that works under mechanism A, decode it under mechanism B).
* Ranking-aware reconstruction: a pairwise margin term aligns decoder
  likelihood with within-experiment rank, so generation favors high-ranked
  designs without trusting noisy absolute labels.
* Conditioning dropout (p_mech_drop) teaches the decoder to generate from the
  shared sequence prior even when the mechanism signal is weak — this is what
  makes transfer to an UNSEEN mechanism (splice-switching) expressible.

Architecture (CPU/MPS-trainable):
    one-hot seq -> Conv1D encoder -> mu/logvar(z)
    cond = Embedding(mechanism) + Embedding(chemistry), optional dropout
    z + cond -> GRU decoder (teacher-forced, per-position CE) + length head

Losses: recon CE (masked) + beta*KL + lambda_rank * margin(rank) on
pairwise (within-experiment) negative reconstruction losses.

CLI:
    python -m backend.experiments.benchmark.generative_design \
        --data <pq> --mode train --outdir <dir> [--smoke]
    python -m backend.experiments.benchmark.generative_design \
        --data <pq> --mode generate --load <ckpt.pt> --mechanism splice_switching \
        --n_generate 200 --outdir <dir>
    python -m backend.experiments.benchmark.generative_design \
        --data <pq> --mode eval --load <ckpt.pt> --outdir <dir>
"""

from __future__ import annotations

import argparse
import collections
import json
import random
import re
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
START = 4
N_TOK = 5  # A C G U + START
PAD_LEN = 30
MIN_LEN, MAX_LEN = 12, 28
N_LEN = MAX_LEN - MIN_LEN + 1
MECH_OOV = "mechanism_oov"
CHEM_OOV = "chem_oov"


def seq_to_oh(seqs: list[str]) -> np.ndarray:
    out = np.zeros((len(seqs), PAD_LEN, len(NUCLEOTIDES)), dtype=np.float32)
    for i, s in enumerate(seqs):
        for j, c in enumerate(s[:PAD_LEN]):
            k = NUCLEOTIDES.find(c)
            if k >= 0:
                out[i, j, k] = 1.0
    return out


def seq_to_tokens(seqs: list[str]) -> tuple[np.ndarray, np.ndarray]:
    tok = np.full((len(seqs), PAD_LEN), -1, dtype=np.int64)
    lens = np.zeros(len(seqs), dtype=np.int64)
    for i, s in enumerate(seqs):
        t = [NUCLEOTIDES.index(c) for c in s if c in NUCLEOTIDES][:PAD_LEN]
        tok[i, : len(t)] = t
        lens[i] = len(t)
    return tok, lens


def tokens_to_seq(tok: np.ndarray, lens: np.ndarray | None = None) -> list[str]:
    out = []
    for i in range(tok.shape[0]):
        l = int(lens[i]) if lens is not None else PAD_LEN
        out.append("".join(NUCLEOTIDES[t] for t in tok[i, :l] if 0 <= t < 4))
    return out


class ConvEncoder(nn.Module):
    def __init__(self, d: int = 128):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv1d(4, d, 5, padding=2), nn.ReLU(),
            nn.Conv1d(d, d, 5, padding=2), nn.ReLU(),
            nn.Conv1d(d, d, 3, padding=1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:  # (B,PAD,4)
        h = self.conv(x.transpose(1, 2))  # (B,d,PAD)
        return h.max(dim=2).values  # (B,d)


class CondEmbed(nn.Module):
    def __init__(self, n_mech: int, n_chem: int, d: int, p_drop: float = 0.0):
        super().__init__()
        self.mech = nn.Embedding(n_mech, d)
        self.chem = nn.Embedding(n_chem, d)
        self.drop = nn.Dropout(p_drop)
        self.p_drop = p_drop

    def forward(self, mech: torch.Tensor,
                chem: torch.Tensor) -> torch.Tensor:
        me = self.mech(mech)
        ce = self.chem(chem)
        if self.training and self.p_drop > 0.0:
            mask = (torch.rand(me.shape[0], device=me.device) < self.p_drop)
            me = me * (~mask).unsqueeze(1).float()
            ce = ce * (~mask).unsqueeze(1).float()
        return torch.cat([me, ce], dim=1)  # (B,2d)


class GRUDecoder(nn.Module):
    def __init__(self, z_dim: int, cond_dim: int, emb_d: int = 32,
                 hid_d: int = 128):
        super().__init__()
        self.emb = nn.Embedding(N_TOK, emb_d)
        self.gru = nn.GRU(emb_d + z_dim + cond_dim, hid_d, batch_first=True)
        self.out = nn.Linear(hid_d, 4)
        self.init_proj = nn.Linear(z_dim + cond_dim, hid_d)

    def _init_hidden(self, z: torch.Tensor, cond: torch.Tensor) -> torch.Tensor:
        return torch.tanh(self.init_proj(torch.cat([z, cond], dim=1))).unsqueeze(0)

    def forward(self, z: torch.Tensor, cond: torch.Tensor,
                tokens: torch.Tensor, lens: torch.Tensor):
        B = z.shape[0]
        tokens = tokens.clamp(min=0)
        start = torch.full((B, 1), START, dtype=torch.long, device=tokens.device)
        inp = torch.cat([start, tokens[:, :-1]], dim=1)  # (B,PAD)
        c = cond.unsqueeze(1).expand(B, PAD_LEN, cond.shape[1])
        zc = z.unsqueeze(1).expand(B, PAD_LEN, z.shape[1])
        x = torch.cat([self.emb(inp), zc, c], dim=2)  # (B,PAD,emb+z+cond)
        h, _ = self.gru(x, self._init_hidden(z, cond))
        logits = self.out(h)  # (B,PAD,4)
        mask = (torch.arange(PAD_LEN, device=lens.device).unsqueeze(0)
                < lens.unsqueeze(1))
        return logits, mask

    def sample(self, z: torch.Tensor, cond: torch.Tensor,
               lens: torch.Tensor, gc_target: float | None = None) -> np.ndarray:
        """Autoregressive sampling, optionally GC-steered.

        When ``gc_target`` is set the per-position token distribution is
        reweighted so the expected GC content of the finished oligo matches
        the target (i.e. the generator corrects its GC bias AT THE SOURCE,
        during decoding, instead of post-hoc candidate filtering). We track
        the GC count decided so far and reweight the G/C vs A/U probabilities
        to the remaining-count target at every position.
        """
        B = z.shape[0]
        hid = self._init_hidden(z, cond)
        out_tok = np.full((B, PAD_LEN), -1, dtype=np.int64)
        cur = torch.full((B, 1), START, dtype=torch.long, device=z.device)
        gc_dec = torch.zeros(B, device=z.device)
        gc_mask = torch.zeros(4, device=z.device)
        gc_mask[1] = gc_mask[2] = 1.0  # NUCLEOTIDES = ACGU -> C, G
        for t in range(PAD_LEN):
            t_ok = torch.arange(B, device=lens.device)[lens > t]
            if t_ok.numel() == 0:
                break
            x = torch.cat([self.emb(cur),
                           z.unsqueeze(1).expand(B, 1, z.shape[1]),
                           cond.unsqueeze(1).expand(B, 1, cond.shape[1])],
                          dim=2)
            h, hid = self.gru(x, hid)
            logits = self.out(h[:, -1])  # (B,4)
            probs = F.softmax(logits, dim=1)
            if gc_target is not None:
                remaining = (lens.to(torch.float32) - t).clamp(min=1.0)
                desired = (gc_target * lens.to(torch.float32) - gc_dec
                           ).clamp(min=torch.zeros_like(remaining),
                                   max=remaining)
                p_gc = desired / remaining
                gc_prob = (probs[:, 1] + probs[:, 2]).clamp(min=1e-6)
                scale_gc = (p_gc / gc_prob).clamp(max=1e3)
                scale_au = ((1.0 - p_gc) / (1.0 - gc_prob)).clamp(max=1e3)
                w = torch.where(gc_mask[None, :] > 0,
                                scale_gc[:, None], scale_au[:, None])
                probs = probs * w
                probs = probs / probs.sum(dim=1, keepdim=True)
            draw = torch.multinomial(probs, 1)
            out_tok[t_ok, t] = draw[t_ok, 0].cpu().numpy()
            if gc_target is not None:
                gc_dec = gc_dec + (draw[:, 0] == 1).float() \
                    + (draw[:, 0] == 2).float()
            cur = draw
        return out_tok


class LengthHead(nn.Module):
    def __init__(self, z_dim: int, cond_dim: int, hid_d: int = 64):
        super().__init__()
        self.mlp = nn.Sequential(
            nn.Linear(z_dim + cond_dim, hid_d), nn.ReLU(),
            nn.Linear(hid_d, N_LEN),
        )

    def forward(self, z: torch.Tensor, cond: torch.Tensor) -> torch.Tensor:
        return self.mlp(torch.cat([z, cond], dim=1))


class MechCVAE(nn.Module):
    def __init__(self, n_mech: int, n_chem: int, d: int = 128,
                 z_dim: int = 64, p_mech_drop: float = 0.0,
                 lambda_rank: float = 0.1, beta: float = 0.1,
                 free_bits: float = 0.0):
        super().__init__()
        self.d, self.z_dim = d, z_dim
        self.encoder = ConvEncoder(d)
        self.cond = CondEmbed(n_mech, n_chem, d, p_drop=p_mech_drop)
        self.q_mu = nn.Linear(d + 2 * d, z_dim)
        self.q_logvar = nn.Linear(d + 2 * d, z_dim)
        self.decoder = GRUDecoder(z_dim, 2 * d)
        self.len_head = LengthHead(z_dim, 2 * d)
        self.lambda_rank = lambda_rank
        self.beta = beta
        self.free_bits = free_bits

    def encode(self, seq_oh: torch.Tensor, mech: torch.Tensor,
               chem: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        zc = torch.cat([self.encoder(seq_oh), self.cond(mech, chem)], dim=1)
        return self.q_mu(zc), self.q_logvar(zc)

    def reparameterize(self, mu: torch.Tensor,
                       logvar: torch.Tensor) -> torch.Tensor:
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std

    def loss_step(self, seq_oh: torch.Tensor, tokens: torch.Tensor,
                  lens: torch.Tensor, mech: torch.Tensor, chem: torch.Tensor,
                  rank_labels: torch.Tensor,
                  exp_ids: list[str]) -> dict:
        mu, logvar = self.encode(seq_oh, mech, chem)
        z = self.reparameterize(mu, logvar)
        cond = self.cond(mech, chem)
        logits, mask = self.decoder(z, cond, tokens, lens)
        ce = F.cross_entropy(
            logits.reshape(-1, 4), tokens.clamp(min=0).reshape(-1),
            reduction="none").view_as(tokens)
        recon = (ce * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1)
        kl_pd = -0.5 * (1 + logvar - mu.pow(2) - logvar.exp())  # (B,z)
        kl = (kl_pd.clamp(min=self.free_bits).sum(dim=1)
              if self.free_bits > 0.0 else kl_pd.sum(dim=1))
        len_ce = F.cross_entropy(
            self.len_head(z, cond), lens - MIN_LEN)
        loss = recon.mean() + self.beta * kl.mean() + 0.1 * len_ce

        rank_loss = torch.zeros((), device=seq_oh.device)
        if self.lambda_rank > 0.0 and len(set(exp_ids)) > 1:
            groups = collections.defaultdict(list)
            for i, e in enumerate(exp_ids):
                groups[e].append(i)
            a_i, b_i, sign = [], [], []
            for _, idx in groups.items():
                if len(idx) < 2:
                    continue
                for k in range(0, len(idx) - 1, 2):
                    i, j = idx[k], idx[k + 1]
                    s = rank_labels[i].item()
                    t = rank_labels[j].item()
                    if s == t:
                        continue
                    a_i.append(i); b_i.append(j)
                    sign.append(1.0 if s > t else -1.0)
            if len(a_i) > 0:
                ra = recon[a_i]
                rb = recon[b_i]
                rank_loss = F.margin_ranking_loss(
                    -ra, -rb, torch.tensor(sign, device=seq_oh.device),
                    margin=0.02)
        total = loss + self.lambda_rank * rank_loss
        return {"total": total, "recon": recon.mean(), "kl": kl.mean(),
                "kl_raw": kl_pd.sum(dim=1).mean(), "len_ce": len_ce,
                "rank": rank_loss}

    def generate(self, mech: torch.Tensor, chem: torch.Tensor,
                 n: int, z: torch.Tensor | None = None,
                 gc_target: float | None = None) -> list[str]:
        if z is None:
            z = torch.randn(n, self.z_dim, device=mech.device)
        cond = self.cond(mech, chem)
        with torch.no_grad():
            len_logits = self.len_head(z, cond)
            lens = torch.softmax(len_logits, dim=1).multinomial(1).squeeze(1)
            lens = (lens + MIN_LEN).clamp(MIN_LEN, MAX_LEN)
            tok = self.decoder.sample(z, cond, lens, gc_target=gc_target)
        return tokens_to_seq(tok, lens.cpu().numpy())


def build_vocabs(df: pd.DataFrame) -> tuple[list[str], list[str]]:
    mechs = sorted(df["modality"].unique())
    chems = sorted(df["chemistry"].unique())
    return mechs + [MECH_OOV], chems + [CHEM_OOV]


def encode_condition(mechs: list[str], chems: list[str],
                     m_list: list[str], c_list: list[str],
                     mech_oov_idx: int, chem_oov_idx: int) -> tuple[np.ndarray, np.ndarray]:
    m_idx = {m: i for i, m in enumerate(mechs)}
    c_idx = {c: i for i, c in enumerate(chems)}
    mm = np.array([m_idx.get(m, mech_oov_idx) for m in m_list], dtype=np.int64)
    cc = np.array([c_idx.get(c, chem_oov_idx) for c in c_list], dtype=np.int64)
    return mm, cc


def train(df: pd.DataFrame, outdir: Path, epochs: int = 25, d: int = 128,
          z_dim: int = 64, batch_size: int = 512, lr: float = 1e-3,
          beta: float = 0.1, lambda_rank: float = 0.1,
          p_mech_drop: float = 0.0, beta_warmup: int = 0,
          free_bits: float = 0.0, smoke: bool = False,
          train_frac: float = 1.0,
          exclude_mechanism: str | None = None) -> dict:
    device = torch.device("cpu")
    mechs, chems = build_vocabs(df)
    mech_oov_idx = len(mechs) - 1
    chem_oov_idx = len(chems) - 1
    if exclude_mechanism is not None:
        keep = df["modality"] != exclude_mechanism
        df = df[keep].reset_index(drop=True)
    model = MechCVAE(len(mechs), len(chems), d=d, z_dim=z_dim,
                     p_mech_drop=p_mech_drop, lambda_rank=lambda_rank,
                     beta=beta, free_bits=free_bits)
    opt = torch.optim.Adam(model.parameters(), lr=lr)

    df = df.reset_index(drop=True)
    mm, cc = encode_condition(mechs, chems,
                              df["modality"].tolist(), df["chemistry"].tolist(),
                              mech_oov_idx, chem_oov_idx)
    rng = np.random.default_rng(0)
    n_use = int(len(df) * train_frac)
    if smoke:
        n_use = min(n_use, 2000)
    idx = rng.choice(len(df), n_use, replace=False)
    df = df.iloc[idx].reset_index(drop=True)
    mm, cc = mm[idx], cc[idx]

    tok, lens = seq_to_tokens(df["seq"].tolist())
    oh = torch.from_numpy(seq_to_oh(df["seq"].tolist()))
    tok_t = torch.from_numpy(tok)
    lens_t = torch.from_numpy(lens)
    mech_t = torch.from_numpy(mm)
    chem_t = torch.from_numpy(cc)
    rank_t = torch.from_numpy(df["rank_label"].to_numpy().astype(np.float32))
    exp_ids = df["experiment_id"].tolist()

    n_batches = int(np.ceil(n_use / batch_size))
    t0 = time.time()
    for ep in range(epochs):
        model.train()
        eff_beta = beta if beta_warmup <= 0 else beta * min(
            1.0, (ep + 1) / beta_warmup)
        perm = rng.permutation(n_use)
        tot = {"total": 0.0, "recon": 0.0, "kl": 0.0, "kl_raw": 0.0,
               "rank": 0.0, "len_ce": 0.0}
        for b in range(n_batches):
            b_idx = perm[b * batch_size:(b + 1) * batch_size]
            losses = model.loss_step(
                oh[b_idx], tok_t[b_idx], lens_t[b_idx],
                mech_t[b_idx], chem_t[b_idx], rank_t[b_idx],
                [exp_ids[i] for i in b_idx])
            losses["total"] = (losses["recon"] + eff_beta * losses["kl"]
                               + 0.1 * losses["len_ce"]
                               + model.lambda_rank * losses["rank"])
            opt.zero_grad()
            losses["total"].backward()
            opt.step()
            for k in tot:
                tot[k] += losses[k].detach().item()
            if smoke and b >= 6:
                break
        print(f"  epoch {ep+1}/{epochs} " + " ".join(
            f"{k}={v/max(n_batches,1):.4f}" for k, v in tot.items())
            + f" ({time.time()-t0:.0f}s)", flush=True)
        if smoke and ep >= 1:
            break

    outdir.mkdir(parents=True, exist_ok=True)
    ckpt = {
        "model_state": model.state_dict(),
        "mechs": mechs, "chems": chems,
        "d": d, "z_dim": z_dim, "p_mech_drop": p_mech_drop,
        "lambda_rank": lambda_rank, "beta": beta,
    }
    ckpt_path = outdir / "generator.pt"
    torch.save(ckpt, ckpt_path)
    return {"checkpoint": str(ckpt_path), "train_rows": int(n_use),
            "mechanisms": mechs[:-1], "chemistry_classes": len(chems) - 1}


def load_model(ckpt_path: Path) -> tuple[MechCVAE, list[str], list[str]]:
    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    model = MechCVAE(len(ckpt["mechs"]), len(ckpt["chems"]), d=ckpt["d"],
                     z_dim=ckpt["z_dim"], p_mech_drop=ckpt["p_mech_drop"],
                     lambda_rank=ckpt["lambda_rank"], beta=ckpt["beta"])
    model.load_state_dict(ckpt["model_state"])
    model.eval()
    return model, ckpt["mechs"], ckpt["chems"]


def gc_mean(df: pd.DataFrame, mechanism: str) -> float:
    """Training-data mean GC for a mechanism (falls back to overall mean)."""
    if mechanism in set(df["modality"]):
        sub = df[df["modality"] == mechanism]
    else:
        sub = df
    return float(sub["seq"].map(lambda s: (s.count("G") + s.count("C"))
                                / max(len(s), 1)).mean())


def generate(df: pd.DataFrame, model: MechCVAE, mechs: list[str],
             chems: list[str], mechanism: str, chemistry: str,
             n: int, recondition_seqs: list[str] | None = None,
             z_topk: int = 0, z_topk_source: str | None = None,
             sample_z: bool = False,
             gc_target: float | None = None) -> list[str]:
    mech_oov_idx = len(mechs) - 1
    chem_oov_idx = len(chems) - 1
    m_list = [mechanism] * n
    c_list = [chemistry] * n
    mm, cc = encode_condition(mechs, chems, m_list, c_list,
                              mech_oov_idx, chem_oov_idx)
    mech_t = torch.from_numpy(mm)
    chem_t = torch.from_numpy(cc)
    seeds = recondition_seqs
    if z_topk > 0:
        src = mechanism if mechanism in set(df["modality"]) else z_topk_source
        src = src if src in set(df["modality"]) else df["modality"].value_counts().index[0]
        top = (df[df["modality"] == src]
               .sort_values("rank_label", ascending=False)
               .head(z_topk)["seq"].tolist())
        seeds = (seeds or []) + top
    if seeds:
        mu, logvar = model.encode(torch.from_numpy(seq_to_oh(seeds)),
                                  mech_t[:len(seeds)],
                                  chem_t[:len(seeds)])
        z = (model.reparameterize(mu, logvar) if sample_z else mu)
        z = z.repeat(1 + n // max(1, len(seeds)), 1)[:n]
        mech_t = mech_t[:n]
        chem_t = chem_t[:n]
    else:
        z = None
    return model.generate(mech_t, chem_t, n, z=z, gc_target=gc_target)


def validity_metrics(seqs: list[str], train_seqs: set[str],
                     min_len: int = MIN_LEN, max_len: int = MAX_LEN) -> dict:
    purity, gc, homorun, novelty = [], [], [], []
    for s in seqs:
        s = s.upper()
        purity.append(1.0 if set(s) <= set(NUCLEOTIDES) and len(s) > 0 else 0.0)
        gc.append(sum(c in "GC" for c in s) / max(len(s), 1))
        run = max((len(r) for r in re.findall(r"(.)\1*", s)), default=1)
        homorun.append(1.0 if run <= 6 else 0.0)
        novelty.append(0.0 if s in train_seqs else 1.0)
    gc_ok = sum(0.25 <= g <= 0.75 for g in gc)
    len_ok = sum(min_len <= len(s) <= max_len for s in seqs)
    n = max(len(seqs), 1)
    return {
        "n_generated": int(len(seqs)),
        "alphabet_purity": float(np.mean(purity)),
        "length_in_range": float(len_ok / n),
        "gc_in_range": float(gc_ok / n),
        "homopolymer_ok": float(np.mean(homorun)),
        "novelty_frac": float(np.mean(novelty)),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, type=Path)
    ap.add_argument("--mode", required=True,
                    choices=["train", "generate", "eval", "pipeline"])
    ap.add_argument("--outdir", required=True, type=Path)
    ap.add_argument("--load", default=None, type=Path)
    ap.add_argument("--ranker_checkpoint", default=None, type=Path,
                    help="rank the generated candidates with this checkpoint")
    ap.add_argument("--epochs", type=int, default=25)
    ap.add_argument("--d", type=int, default=128)
    ap.add_argument("--z_dim", type=int, default=64)
    ap.add_argument("--batch_size", type=int, default=512)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--beta", type=float, default=0.1)
    ap.add_argument("--free_bits", type=float, default=0.0,
                    help="per-dimension KL floor (nats) applied before the "
                         "beta-weighted KL term; prevents posterior collapse "
                         "so the latent stays usable for re-conditioning "
                         "across mechanisms")
    ap.add_argument("--lambda_rank", type=float, default=0.1)
    ap.add_argument("--p_mech_drop", type=float, default=0.0)
    ap.add_argument("--beta_warmup", type=int, default=0,
                    help="ramp beta from 0 to --beta over this many epochs "
                         "(counters posterior collapse so the latent stays "
                         "usable for re-conditioning)")
    ap.add_argument("--train_frac", type=float, default=1.0)
    ap.add_argument("--exclude_mechanism", default=None,
                    help="drop this mechanism from training (keeps its "
                         "embedding) for honest unseen-mechanism transfer")
    ap.add_argument("--mechanism", default="gapmer")
    ap.add_argument("--chemistry", default=CHEM_OOV)
    ap.add_argument("--n_generate", type=int, default=100)
    ap.add_argument("--recondition_seqs", default=None, type=Path,
                    help="file of source sequences to re-encode (one per line)")
    ap.add_argument("--z_topk", type=int, default=0,
                    help=">0: seed latent z from the posterior of the k "
                         "highest-ranked training sequences of the target "
                         "mechanism (rank-aware / top-of-manifold sampling)")
    ap.add_argument("--z_topk_source", default=None,
                    help="mechanism to take top-k seeds from when the target "
                         "mechanism is unseen (defaults to largest modality)")
    ap.add_argument("--sample_z", action="store_true",
                    help="sample z from the posterior (reparameterize) instead "
                         "of using the posterior mean")
    ap.add_argument("--gc_target", type=float, default=None,
                    help="target GC content (fraction) for decoding; the "
                         "decoder is GC-steered at the source so generated "
                         "oligos match this GC instead of post-hoc filtering")
    ap.add_argument("--gc_auto", action="store_true",
                    help="steer each mechanism to its own training-data mean "
                         "GC (OOV mechanisms use the overall mean)")
    ap.add_argument("--conformal_k", type=int, default=0,
                    help=">0: run calibrated top-k acceptance (needs labeled "
                         "target-mechanism experiments)")
    ap.add_argument("--conformal_alpha", type=float, default=0.1)
    ap.add_argument("--conformal_max_groups", type=int, default=200,
                    help="cap on conformal eval groups (bounded eval)")
    ap.add_argument("--smoke", action="store_true")
    args = ap.parse_args()

    args.outdir.mkdir(parents=True, exist_ok=True)
    df = pd.read_parquet(args.data)

    if args.mode == "train":
        res = train(df, args.outdir, epochs=args.epochs, d=args.d,
                    z_dim=args.z_dim, batch_size=args.batch_size, lr=args.lr,
                    beta=args.beta, lambda_rank=args.lambda_rank,
                    p_mech_drop=args.p_mech_drop, beta_warmup=args.beta_warmup,
                    free_bits=args.free_bits, smoke=args.smoke,
                    train_frac=args.train_frac,
                    exclude_mechanism=args.exclude_mechanism)
        print(json.dumps(res, indent=2))
        (args.outdir / "train_result.json").write_text(json.dumps(res, indent=2))

    elif args.mode in ("generate", "eval"):
        assert args.load is not None, "generate/eval require --load"
        model, mechs, chems = load_model(args.load)
        gc_target = (args.gc_target if args.gc_target is not None
                     else gc_mean(df, args.mechanism) if args.gc_auto
                     else None)
        if args.mode == "generate":
            recond = (args.recondition_seqs.read_text().splitlines()
                      if args.recondition_seqs else None)
            seqs = generate(df, model, mechs, chems, args.mechanism,
                            args.chemistry, args.n_generate,
                            recondition_seqs=recond, z_topk=args.z_topk,
                            z_topk_source=args.z_topk_source,
                            sample_z=args.sample_z, gc_target=gc_target)
            train_seqs = set(df["seq"])
            res = validity_metrics(seqs, train_seqs)
            res["mechanism"] = args.mechanism
            res["chemistry"] = args.chemistry
            res["z_topk"] = args.z_topk
            res["sample_z"] = args.sample_z
            res["gc_target"] = gc_target
            res["sample_sequences"] = seqs[:10]
            res_path = args.outdir / "generate_result.json"
            res_path.write_text(json.dumps(res, indent=2))
            print(json.dumps(res, indent=2))
            print(f"wrote {res_path}")
        else:
            train_seqs = set(df["seq"])
            res = {}
            for mech in sorted(df["modality"].unique()) + [MECH_OOV]:
                seqs = generate(df, model, mechs, chems, mech, CHEM_OOV, 100)
                res[mech] = validity_metrics(seqs, train_seqs)
            res_path = args.outdir / "eval_result.json"
            res_path.write_text(json.dumps(res, indent=2))
            print(json.dumps(res, indent=2))
            print(f"wrote {res_path}")

    elif args.mode == "pipeline":
        from .invariant_ranker import load_scorer, score_df
        assert args.load is not None, "pipeline requires --load"
        assert args.ranker_checkpoint is not None, \
            "pipeline requires --ranker_checkpoint"
        model, mechs, chems = load_model(args.load)
        gc_target = (args.gc_target if args.gc_target is not None
                     else gc_mean(df, args.mechanism) if args.gc_auto
                     else None)
        recond = (args.recondition_seqs.read_text().splitlines()
                  if args.recondition_seqs else None)
        seqs = generate(df, model, mechs, chems, args.mechanism,
                        args.chemistry, args.n_generate,
                        recondition_seqs=recond, z_topk=args.z_topk,
                        z_topk_source=args.z_topk_source,
                        sample_z=args.sample_z, gc_target=gc_target)
        rng = np.random.default_rng(0)
        lens = [len(s) for s in seqs]
        rand_seqs = ["".join(rng.choice(list(NUCLEOTIDES), l)) for l in lens]
        ranker, chem_vocab, rmode = load_scorer(args.ranker_checkpoint)
        gdf = pd.DataFrame({"seq": seqs,
                            "chemistry": [args.chemistry] * len(seqs)})
        rdf = pd.DataFrame({"seq": rand_seqs,
                            "chemistry": [args.chemistry] * len(rand_seqs)})
        gs = score_df(ranker, chem_vocab, gdf)
        rs = score_df(ranker, chem_vocab, rdf)
        pooled = np.concatenate([gs, rs])
        res = validity_metrics(seqs, set(df["seq"]))
        res.update({
            "mechanism": args.mechanism,
            "chemistry": args.chemistry,
            "ranker_mode": rmode,
            "gen_score_mean": float(np.mean(gs)),
            "rand_score_mean": float(np.mean(rs)),
            "gen_score_median": float(np.median(gs)),
            "rand_score_median": float(np.median(rs)),
            "score_lift_mean": float(np.mean(gs) - np.mean(rs)),
            "gen_frac_in_top20": float(np.mean(gs >= np.quantile(pooled, 0.8))),
            "n_ranked": int(len(gs)),
            "gc_target": gc_target,
            "gen_gc_mean": float(np.mean([sum(c in "GC" for c in s)
                                          / max(len(s), 1) for s in seqs])),
            "rand_gc_mean": float(np.mean([sum(c in "GC" for c in s)
                                           / max(len(s), 1) for s in rand_seqs])),
        })

        if args.conformal_k > 0:
            from .invariant_ranker import conformal_topk
            if args.mechanism in set(df["modality"]):
                tgt = df[df["modality"] == args.mechanism].copy()
                tgt = tgt[tgt.groupby("experiment_id")["seq"].transform("size")
                          >= args.conformal_k]
                rng = np.random.default_rng(0)
                exps = sorted(tgt["experiment_id"].unique())
                keep = set(rng.choice(exps, min(args.conformal_max_groups,
                                                len(exps)), replace=False))
                tgt = tgt[tgt["experiment_id"].isin(keep)]
                group_scores, group_topk, group_sizes = {}, {}, {}
                for e, g in tgt.groupby("experiment_id", sort=False):
                    if len(g) < args.conformal_k:
                        continue
                    sc = score_df(ranker, chem_vocab, g)
                    k = min(args.conformal_k, len(g))
                    topk = np.zeros(len(g), dtype=bool)
                    topk[np.argsort(g["rank_label"].to_numpy())[-k:]] = True
                    group_scores[e] = sc
                    group_topk[e] = topk
                    group_sizes[e] = len(g)
                conf = conformal_topk(group_scores, group_topk, group_sizes,
                                      k=args.conformal_k,
                                      alpha=args.conformal_alpha)
                res["conformal"] = conf
        res_path = args.outdir / "pipeline_result.json"
        res_path.write_text(json.dumps(res, indent=2))
        print(json.dumps(res, indent=2))
        print(f"wrote {res_path}")


if __name__ == "__main__":
    main()
