"""Train TokenCrossAttention with v1-style enhancements.

Protocol (matches GatedFusionNet/CrossAttentionFusion):
  5-fold CV (KFold, shuffle, random_state=42), Adam, MSE,
  lr=1e-3, weight_decay=1e-5, batch=32, max 100 epochs, early stopping
  patience=10, cosine annealing scheduler, per-fold seed = SEED+fold.

Architecture (Phase 12 + v1 enhancements):
  proj(640->256) -> target_encoder -> cross-attn(ASO q over target kv, 8 heads)
  -> self-attn(ASO) -> mean pool -> concat acc(11)+hc(9)=276 -> head 276-256-128-64-1.

v1 enhancements (all ON by default):
  token_norm, use_pos_encoding, target_encoder, cross_residual,
  use_target_pool, use_bilinear.

Saves to backend/results/exp12_token_attention/:
  config.yaml         - full hyperparameters + data description
  best_model.pt       - best fold's model state dict
  best_model_fold{i}.pt - state dict per fold
  metrics.json        - per-fold + mean/sd metrics
  train_log.csv       - per-epoch metrics for all folds
  predictions.csv     - fold, sample index, true efficacy, prediction
  attention_weights.pt- cross-attention matrices (N, 19, 57) per val fold
  training_curve.png  - averaged train/val loss + val Pearson curves

Run: python backend/experiments/train_token_attention.py [output_dir]
"""

import os
import sys
import json
import csv
import yaml
import numpy as np
import torch
from sklearn.model_selection import KFold

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from backend.datasets.huesken import HueskenDataset
from backend.datasets.token_dataset import TokenDataset
from backend.models.token_cross_attention import TokenCrossAttention

N_FOLDS = 5
SEED = 42
EPOCHS = 100
PATIENCE = 10
LR = 1e-3
WEIGHT_DECAY = 1e-5
BATCH_SIZE = 32
DROPOUT = 0.2

D_MODEL = 256
N_HEADS = 8
RNAFM_DIM = 640
ACC_DIM = 11
HC_DIM = 9

# Optional v1-style enhancements (Phase 12 core + these = "v2").
TOKEN_NORM = True
USE_POS_ENCODING = True
TARGET_ENCODER = True
NUM_TARGET_BLOCKS = 2
ASO_SELF_ATTN = True
CROSS_RESIDUAL = True
USE_TARGET_POOL = True
USE_BILINEAR = True

EXPERIMENT_DIR = sys.argv[1] if len(sys.argv) > 1 else "backend/results/exp12_token_attention"


def pearson_corr(preds, targets):
    if preds.std() == 0 or targets.std() == 0:
        return 0.0
    return np.corrcoef(preds, targets)[0, 1]


def compute_metrics(preds, targets):
    preds = np.asarray(preds)
    targets = np.asarray(targets)
    mse = float(np.mean((preds - targets) ** 2))
    mae = float(np.mean(np.abs(preds - targets)))
    pearson = float(pearson_corr(preds, targets))
    ss_res = float(np.sum((targets - preds) ** 2))
    ss_tot = float(np.sum((targets - targets.mean()) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
    return {"pearson": pearson, "r2": r2, "mse": mse, "mae": mae}


def load_data():
    """Extract full tensors from TokenDataset (token cache)."""
    token_dataset = TokenDataset(HueskenDataset("OligoFormer/data/Hu.csv"))
    n = len(token_dataset)
    aso = torch.zeros(n, token_dataset.aso_len, RNAFM_DIM)
    target = torch.zeros(n, token_dataset.target_len, RNAFM_DIM)
    acc = torch.zeros(n, ACC_DIM)
    hc = torch.zeros(n, HC_DIM)
    y = torch.zeros(n)

    for i in range(n):
        s = token_dataset[i]
        aso[i] = s["aso_tokens"]
        target[i] = s["target_tokens"]
        acc[i] = s["accessibility"]
        hc[i] = s["handcrafted"]
        y[i] = s["label"]

    print(f"Loaded {n} samples | aso {tuple(aso.shape)} | target {tuple(target.shape)} "
          f"| acc {tuple(acc.shape)} | hc {tuple(hc.shape)}")
    return aso, target, acc, hc, y


def train_one_fold(aso, target, acc, hc, y, train_idx, val_idx, seed, fold_idx):
    """Train one fold. Returns dict with model, curve, metrics, attn, etc."""
    torch.manual_seed(seed)
    np.random.seed(seed)

    A_tr, M_tr, acc_tr, hc_tr, y_tr = aso[train_idx], target[train_idx], acc[train_idx], hc[train_idx], y[train_idx]
    A_va, M_va, acc_va, hc_va, y_va = aso[val_idx], target[val_idx], acc[val_idx], hc[val_idx], y[val_idx]

    model = TokenCrossAttention(
        rnafm_dim=RNAFM_DIM,
        d_model=D_MODEL,
        n_heads=N_HEADS,
        acc_dim=ACC_DIM,
        hc_dim=HC_DIM,
        dropout=DROPOUT,
        aso_len=aso.shape[1],
        target_len=target.shape[1],
        token_norm=TOKEN_NORM,
        use_pos_encoding=USE_POS_ENCODING,
        target_encoder=TARGET_ENCODER,
        num_target_blocks=NUM_TARGET_BLOCKS,
        aso_self_attn=ASO_SELF_ATTN,
        cross_residual=CROSS_RESIDUAL,
        use_target_pool=USE_TARGET_POOL,
        use_bilinear=USE_BILINEAR,
    )

    optimizer = torch.optim.Adam(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS, eta_min=1e-6)
    loss_fn = torch.nn.MSELoss()

    n_train = len(y_tr)
    curve = []
    best_val_loss = float("inf")
    best_val_pearson = -float("inf")
    patience_counter = 0
    best_state = None
    best_attn = None
    best_epoch = 0

    for epoch in range(EPOCHS):
        model.train()
        perm = torch.randperm(n_train)
        epoch_loss = 0.0
        n_batches = 0
        all_preds = []
        all_targets = []

        for start in range(0, n_train, BATCH_SIZE):
            idx = perm[start:start + BATCH_SIZE]
            if len(idx) < 2:
                continue
            pred, _ = model(A_tr[idx], M_tr[idx], acc_tr[idx], hc_tr[idx])
            loss = loss_fn(pred, y_tr[idx])
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            epoch_loss += loss.item()
            n_batches += 1
            all_preds.append(pred.detach().numpy())
            all_targets.append(y_tr[idx].numpy())

        model.eval()
        with torch.no_grad():
            val_pred, val_attn = model(A_va, M_va, acc_va, hc_va)
            val_loss = loss_fn(val_pred, y_va).item()

        train_loss = epoch_loss / max(n_batches, 1)
        train_metrics = compute_metrics(
            np.concatenate(all_preds).flatten() if all_preds else [],
            np.concatenate(all_targets).flatten() if all_targets else [],
        )
        val_metrics = compute_metrics(val_pred.numpy(), y_va.numpy())

        curve.append({
            "fold": fold_idx + 1,
            "epoch": epoch + 1,
            "train_loss": round(float(train_loss), 6),
            "val_loss": round(float(val_loss), 6),
            "val_pearson": round(val_metrics["pearson"], 6),
            "val_r2": round(val_metrics["r2"], 6),
            "val_mae": round(val_metrics["mae"], 6),
            "val_mse": round(val_metrics["mse"], 6),
        })

        scheduler.step()

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_val_pearson = val_metrics["pearson"]
            best_epoch = epoch + 1
            patience_counter = 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            best_attn = val_attn.detach().cpu().clone()  # (N_val, 19, 57)
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE:
                break

    model.load_state_dict(best_state)
    model.eval()
    with torch.no_grad():
        final_pred = model(A_va, M_va, acc_va, hc_va)[0].numpy()

    return {
        "model": model,
        "best_state": best_state,
        "curve": curve,
        "best_val_loss": best_val_loss,
        "best_val_pearson": best_val_pearson,
        "best_epoch": best_epoch,
        "best_attn": best_attn,
        "val_pred": final_pred,
        "val_true": y_va.numpy(),
        "val_idx": val_idx,
    }


def main():
    torch.manual_seed(SEED)
    np.random.seed(SEED)

    os.makedirs(EXPERIMENT_DIR, exist_ok=True)

    print("Loading data...")
    aso, target, acc, hc, y = load_data()

    kf = KFold(n_splits=N_FOLDS, shuffle=True, random_state=SEED)
    indices = np.arange(len(y))

    fold_results = []
    all_curves = []
    all_attn = {}
    prediction_rows = []

    print(f"\n{'='*60}")
    print("  TokenCrossAttention — 5-Fold CV (identical protocol)")
    print(f"{'='*60}")

    for fold_idx, (train_idx, val_idx) in enumerate(kf.split(indices)):
        print(f"  Fold {fold_idx + 1}/{N_FOLDS}...", end=" ", flush=True)
        res = train_one_fold(
            aso, target, acc, hc, y, train_idx, val_idx,
            seed=SEED + fold_idx, fold_idx=fold_idx,
        )

        metrics = compute_metrics(res["val_pred"], res["val_true"])
        fold_results.append(metrics)
        all_curves.extend(res["curve"])
        all_attn[f"fold_{fold_idx + 1}"] = res["best_attn"]

        # per-fold checkpoints
        torch.save(
            {
                "fold": fold_idx + 1,
                "state_dict": res["best_state"],
                "val_pearson": metrics["pearson"],
                "val_r2": metrics["r2"],
"architecture": {
                     "rnafm_dim": RNAFM_DIM, "d_model": D_MODEL, "n_heads": N_HEADS,
                     "acc_dim": ACC_DIM, "hc_dim": HC_DIM, "dropout": DROPOUT,
                     "token_norm": TOKEN_NORM, "use_pos_encoding": USE_POS_ENCODING,
                     "target_encoder": TARGET_ENCODER, "num_target_blocks": NUM_TARGET_BLOCKS,
                     "aso_self_attn": ASO_SELF_ATTN, "cross_residual": CROSS_RESIDUAL,
                     "use_target_pool": USE_TARGET_POOL, "use_bilinear": USE_BILINEAR,
                 },
            },
            os.path.join(EXPERIMENT_DIR, f"best_model_fold{fold_idx + 1}.pt"),
        )

        for i, (gi, t, p) in enumerate(zip(val_idx, res["val_true"], res["val_pred"])):
            prediction_rows.append({
                "fold": fold_idx + 1,
                "sample_index": int(gi),
                "true_efficacy": round(float(t), 6),
                "prediction": round(float(p), 6),
            })

        print(f"Pearson={metrics['pearson']:.4f}  R²={metrics['r2']:.4f}  "
              f"MSE={metrics['mse']:.4f}  MAE={metrics['mae']:.4f}  "
              f"(best epoch {res['best_epoch']}, val_loss={res['best_val_loss']:.4f})")

    # ---- Summary ----
    pearsons = [r["pearson"] for r in fold_results]
    r2s = [r["r2"] for r in fold_results]
    mses = [r["mse"] for r in fold_results]
    maes = [r["mae"] for r in fold_results]

    summary = {
        "model_type": "TokenCrossAttention",
        "description": "Token-level cross-attention (Phase 12 + v1 enhancements): "
                       "proj(640->256) -> target_encoder -> cross-attn(ASO q over target kv, 8 heads) "
                       "-> self-attn(ASO) -> mean pool -> concat acc(11)+hc(9)=276 "
                       "-> head 276-256-128-64-1. "
                       "v1 enhancements: token_norm, pos_encoding, target_encoder, cross_residual, "
                       "use_target_pool, use_bilinear.",
        "protocol": "Identical to GatedFusionNet/CrossAttentionFusion: 5-fold CV "
                    "seed 42, Adam, MSE, lr=1e-3, wd=1e-5, batch=32, 100 epochs, "
                    "patience=10, cosine annealing scheduler, per-fold seed = SEED+fold.",
        "folds": [
            {"fold": i + 1, **fold_results[i]} for i in range(N_FOLDS)
        ],
        "pearson_mean": round(float(np.mean(pearsons)), 6),
        "pearson_sd": round(float(np.std(pearsons)), 6),
        "r2_mean": round(float(np.mean(r2s)), 6),
        "r2_sd": round(float(np.std(r2s)), 6),
        "mse_mean": round(float(np.mean(mses)), 6),
        "mse_sd": round(float(np.std(mses)), 6),
        "mae_mean": round(float(np.mean(maes)), 6),
        "mae_sd": round(float(np.std(maes)), 6),
    }

    # ---- Save everything ----
    config = {
        "experiment": "exp11_token_attention",
        "model_type": "TokenCrossAttention",
        "data_description": {
            "source": "OligoFormer/data/Hu.csv (2,361 ASO-mRNA pairs)",
            "aso_tokens": [aso.shape[0], aso.shape[1], aso.shape[2]],
            "target_tokens": [target.shape[0], target.shape[1], target.shape[2]],
            "target_construction": (
                "Target is the FULL 57-nt mRNA window from the Huesken dataset — NOT "
                "truncated or padded by this pipeline. Verified: the ASO binding site "
                "(reverse complement) starts at position 19 in every sample, so the "
                "57-nt window = 19 nt upstream + 19 nt binding site + 19 nt downstream, "
                "centered on the target site. Per-nucleotide RNA-FM layer-12 embeddings "
                "were extracted with <cls>/<eos> specials stripped (see "
                "backend/features/rnafm.py embed_batch_with_tokens). Fixed lengths -> "
                "no padding, no attention mask."
            ),
            "aso_construction": (
                "Full 19-nt ASO (siRNA column). Same token extraction, specials stripped."
            ),
        },
        "hyperparameters": {
            "optimizer": "Adam",
            "learning_rate": LR,
            "weight_decay": WEIGHT_DECAY,
            "batch_size": BATCH_SIZE,
            "epochs": EPOCHS,
            "patience": PATIENCE,
            "n_folds": N_FOLDS,
            "seed": SEED,
            "scheduler": "cosine annealing (T_max=EPOCHS, eta_min=1e-6)",
        },
        "architecture": {
            "rnafm_dim": RNAFM_DIM,
            "d_model": D_MODEL,
            "n_heads": N_HEADS,
            "acc_dim": ACC_DIM,
            "hc_dim": HC_DIM,
            "dropout": DROPOUT,
            "head": [276, 256, 128, 64, 1],
            "head_normalization": "BatchNorm1d (matches prior-model protocol)",
            "token_norm": TOKEN_NORM,
            "use_pos_encoding": USE_POS_ENCODING,
            "target_encoder": TARGET_ENCODER,
            "num_target_blocks": NUM_TARGET_BLOCKS,
            "aso_self_attn": ASO_SELF_ATTN,
            "cross_residual": CROSS_RESIDUAL,
            "use_target_pool": USE_TARGET_POOL,
            "use_bilinear": USE_BILINEAR,
        },
    }
    with open(os.path.join(EXPERIMENT_DIR, "config.yaml"), "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    with open(os.path.join(EXPERIMENT_DIR, "metrics.json"), "w") as f:
        json.dump(summary, f, indent=2)

    with open(os.path.join(EXPERIMENT_DIR, "train_log.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(all_curves[0].keys()))
        writer.writeheader()
        writer.writerows(all_curves)

    with open(os.path.join(EXPERIMENT_DIR, "predictions.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["fold", "sample_index", "true_efficacy", "prediction"])
        writer.writeheader()
        writer.writerows(prediction_rows)

    torch.save(all_attn, os.path.join(EXPERIMENT_DIR, "attention_weights.pt"))

    # Best model (highest fold Pearson)
    best_fold = int(np.argmax(pearsons))
    torch.save(
        {
            "fold": best_fold + 1,
            "state_dict": torch.load(
                os.path.join(EXPERIMENT_DIR, f"best_model_fold{best_fold + 1}.pt"),
                weights_only=False,
            )["state_dict"],
            "val_pearson": pearsons[best_fold],
            "architecture": config["architecture"],
        },
        os.path.join(EXPERIMENT_DIR, "best_model.pt"),
    )

    # Training curve plot (averaged over folds)
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        df_rows = all_curves
        max_epochs = max(r["epoch"] for r in df_rows)
        avg = {}
        for ep in range(1, max_epochs + 1):
            rows = [r for r in df_rows if r["epoch"] == ep]
            if not rows:
                continue
            avg[ep] = {
                "train_loss": np.mean([r["train_loss"] for r in rows]),
                "val_loss": np.mean([r["val_loss"] for r in rows]),
                "val_pearson": np.mean([r["val_pearson"] for r in rows]),
            }

        eps = list(avg.keys())
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
        ax1.plot(eps, [avg[e]["train_loss"] for e in eps], label="Train Loss", color="steelblue")
        ax1.plot(eps, [avg[e]["val_loss"] for e in eps], label="Val Loss", color="darkorange")
        ax1.set_xlabel("Epoch")
        ax1.set_ylabel("MSE Loss")
        ax1.set_title("TokenCrossAttention — Training Curve")
        ax1.legend()

        ax2.plot(eps, [avg[e]["val_pearson"] for e in eps], label="Val Pearson", color="green")
        ax2.set_xlabel("Epoch")
        ax2.set_ylabel("Pearson r")
        ax2.set_title("TokenCrossAttention — Validation Pearson")
        ax2.legend()

        plt.tight_layout()
        plt.savefig(os.path.join(EXPERIMENT_DIR, "training_curve.png"), dpi=150)
        plt.close()
    except Exception as e:
        print(f"  Warning: could not generate plot: {e}")

    # ---- Console summary table ----
    print(f"\n{'='*50}")
    print("TokenCrossAttention — 5-Fold CV Results")
    print(f"{'='*50}")
    print(f"{'Fold':<6} {'Pearson':>9} {'R²':>9} {'MSE':>9} {'MAE':>9}")
    print(f"{'-'*6} {'-'*9} {'-'*9} {'-'*9} {'-'*9}")
    for i, r in enumerate(fold_results):
        print(f"{i + 1:<6} {r['pearson']:>9.4f} {r['r2']:>9.4f} {r['mse']:>9.4f} {r['mae']:>9.4f}")
    print(f"{'-'*6} {'-'*9} {'-'*9} {'-'*9} {'-'*9}")
    print(f"{'Mean':<6} {np.mean(pearsons):>9.4f} {np.mean(r2s):>9.4f} {np.mean(mses):>9.4f} {np.mean(maes):>9.4f}")
    print(f"{'SD':<6} {np.std(pearsons):>9.4f} {np.std(r2s):>9.4f} {np.std(mses):>9.4f} {np.std(maes):>9.4f}")
    print(f"\nResults saved to {EXPERIMENT_DIR}/")


if __name__ == "__main__":
    main()
