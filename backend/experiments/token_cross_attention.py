"""Token-Level Cross-Attention Transformer (TokenCrossAttention) Experiment.

Phase 11: tests whether modeling the interaction at the NUCLEOTIDE level
(as opposed to the single-vector, feature-level attention of Phase 10)
improves ASO efficacy prediction.

The model consumes per-nucleotide RNA-FM token embeddings:
  - ASO     : (N, 19, 640)   (19 nt)
  - Target  : (N, 57, 640)   (57 nt, pre-windowed: 19 up + 19 binding + 19 down)

Training protocol is IDENTICAL to the previous experiments: 5-fold CV
(seed 42), Adam, MSE, lr=1e-3, dropout=0.2, weight_decay=1e-5, batch=32,
early stopping patience=10, max 100 epochs.
"""

import os
import sys
import json
import yaml
import numpy as np
import torch
from sklearn.model_selection import KFold

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from backend.datasets.huesken import HueskenDataset
from backend.models.token_cross_attention_v1 import (
    TokenCrossAttentionV1 as TokenCrossAttention,
    ASO_LEN,
    TARGET_LEN,
)
from backend.features.embed_cache import (
    CACHE_FILE,
    TOKEN_CACHE_FILE,
)
from backend.datasets.ablation_dataset import (
    HANDSCRFTED_KEYS,
    HANDSCRFTED_DIM,
)

N_FOLDS = 5
SEED = 42
EPOCHS = 100
PATIENCE = 10
LR = 1e-3
WEIGHT_DECAY = 1e-5
BATCH_SIZE = 32
DROPOUT = 0.2

EXPERIMENT_DIR = "backend/experiments/exp11_token_cross_attention"
RNAFM_DIM = 640
D_MODEL = 128
N_HEADS = 4
ACC_DIM = 11
HC_DIM = HANDSCRFTED_DIM


def pearson_corr(preds, targets):
    if preds.std() == 0 or targets.std() == 0:
        return 0.0
    return np.corrcoef(preds, targets)[0, 1]


def load_data():
    """Load token embeddings + accessibility + handcrafted features."""
    data = torch.load(TOKEN_CACHE_FILE, weights_only=True)
    aso_tokens = data["aso_tokens"]
    mrna_tokens = data["mrna_tokens"]
    labels = data["labels"]

    pooled = torch.load(CACHE_FILE, weights_only=True)
    accessibility = pooled["accessibility"]

    base = HueskenDataset("OligoFormer/data/Hu.csv")
    n = len(base)
    handcrafted = torch.zeros(n, HANDSCRFTED_DIM, dtype=torch.float32)
    for i in range(n):
        feats = base[i]["features"]
        handcrafted[i] = torch.tensor(
            [feats[k] for k in HANDSCRFTED_KEYS], dtype=torch.float32
        )

    print(f"Loaded {n} samples")
    print(f"  aso_tokens   : {tuple(aso_tokens.shape)}")
    print(f"  mrna_tokens  : {tuple(mrna_tokens.shape)}")
    print(f"  accessibility: {tuple(accessibility.shape)}")
    print(f"  handcrafted  : {tuple(handcrafted.shape)}")
    return aso_tokens, mrna_tokens, accessibility, handcrafted, labels


def train_one_fold(aso, mrna, acc, hc, y_train_idx, y_val_idx, y, seed):
    """Train a single fold. Returns (model, train_curve, best_val_loss, attn)."""
    torch.manual_seed(seed)
    np.random.seed(seed)

    A_train = aso[y_train_idx]
    M_train = mrna[y_train_idx]
    acc_train = acc[y_train_idx]
    hc_train = hc[y_train_idx]
    y_tr = y[y_train_idx]

    A_val = aso[y_val_idx]
    M_val = mrna[y_val_idx]
    acc_val = acc[y_val_idx]
    hc_val = hc[y_val_idx]
    y_va = y[y_val_idx]

    model = TokenCrossAttention(
        rnafm_dim=RNAFM_DIM,
        d_model=D_MODEL,
        n_heads=N_HEADS,
        aso_len=ASO_LEN,
        target_len=TARGET_LEN,
        acc_dim=ACC_DIM,
        hc_dim=HC_DIM,
        gate_hidden=32,
        dropout=DROPOUT,
        hidden_dims=[512, 256, 128, 64],
    )

    optimizer = torch.optim.Adam(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    loss_fn = torch.nn.MSELoss()

    n_train = len(y_tr)
    train_curve = []
    best_val_loss = float("inf")
    patience_counter = 0
    best_model_state = None
    best_attn = None

    for epoch in range(EPOCHS):
        model.train()
        perm = torch.randperm(n_train)
        epoch_loss = 0.0
        n_batches = 0
        all_train_preds = []
        all_train_targets = []

        for start in range(0, n_train, BATCH_SIZE):
            idx = perm[start:start + BATCH_SIZE]
            if len(idx) < 2:
                continue
            pred = model(A_train[idx], M_train[idx], acc_train[idx], hc_train[idx])
            loss = loss_fn(pred, y_tr[idx])
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()
            n_batches += 1
            all_train_preds.append(pred.detach().numpy())
            all_train_targets.append(y_tr[idx].numpy())

        model.eval()
        with torch.no_grad():
            val_pred = model(A_val, M_val, acc_val, hc_val)
            val_loss = loss_fn(val_pred, y_va)

        avg_train_loss = epoch_loss / max(n_batches, 1)
        train_preds = np.concatenate(all_train_preds).flatten() if all_train_preds else np.array([])
        train_targets = np.concatenate(all_train_targets).flatten() if all_train_targets else np.array([])
        train_pearson = pearson_corr(train_preds, train_targets) if len(train_preds) > 1 else 0.0
        val_pearson = pearson_corr(val_pred.numpy(), y_va.numpy()) if len(val_pred) > 1 else 0.0

        train_curve.append({
            "epoch": epoch + 1,
            "train_loss": float(avg_train_loss),
            "val_loss": float(val_loss.item()),
            "val_pearson": float(val_pearson),
            "train_pearson": float(train_pearson),
        })

        if val_loss.item() < best_val_loss:
            best_val_loss = val_loss.item()
            patience_counter = 0
            best_model_state = {k: v.clone() for k, v in model.state_dict().items()}
            with torch.no_grad():
                best_attn = model.get_attention_weights(
                    A_val, M_val, acc_val, hc_val
                ).detach().cpu().numpy()
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE:
                break

    if best_model_state is not None:
        model.load_state_dict(best_model_state)

    return model, train_curve, best_val_loss, best_attn


def evaluate(model, A, M, acc, hc, y):
    model.eval()
    with torch.no_grad():
        preds = model(A, M, acc, hc).numpy()

    targets_np = y.numpy()
    mse = np.mean((preds - targets_np) ** 2)
    mae = np.mean(np.abs(preds - targets_np))
    pearson = pearson_corr(preds, targets_np) if preds.std() > 0 else 0.0
    ss_res = np.sum((targets_np - preds) ** 2)
    ss_tot = np.sum((targets_np - targets_np.mean()) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return {
        "pearson": float(pearson),
        "r2": float(r2),
        "mse": float(mse),
        "mae": float(mae),
    }


def run_experiment(aso, mrna, acc, hc, y):
    """Run 5-fold CV for TokenCrossAttention."""
    indices = np.arange(len(y))
    kf = KFold(n_splits=N_FOLDS, shuffle=True, random_state=SEED)

    fold_results = []
    all_train_curves = []
    all_attn = []

    for fold_idx, (train_idx, val_idx) in enumerate(kf.split(indices)):
        print(f"  Fold {fold_idx + 1}/{N_FOLDS}...", end=" ", flush=True)

        model, train_curve, best_val_loss, attn = train_one_fold(
            aso, mrna, acc, hc, train_idx, val_idx, y, seed=SEED + fold_idx
        )

        metrics = evaluate(model, aso[val_idx], mrna[val_idx],
                           acc[val_idx], hc[val_idx], y[val_idx])
        fold_results.append(metrics)
        all_train_curves.append(train_curve)
        if attn is not None:
            all_attn.append(attn)

        print(f"Pearson={metrics['pearson']:.4f}  R²={metrics['r2']:.4f}  "
              f"MSE={metrics['mse']:.4f}  (val_loss={best_val_loss:.4f})")

    pearsons = [r["pearson"] for r in fold_results]
    r2s = [r["r2"] for r in fold_results]
    mses = [r["mse"] for r in fold_results]
    maes = [r["mae"] for r in fold_results]

    summary = {
        "model_type": "token_cross_attention",
        "description": "TokenCrossAttention (nucleotide-level cross-attention transformer)",
        "input_shapes": {
            "aso_tokens": list(aso.shape),
            "mrna_tokens": list(mrna.shape),
            "accessibility": list(acc.shape),
            "handcrafted": list(hc.shape),
        },
        "architecture": {
            "rnafm_dim": RNAFM_DIM,
            "d_model": D_MODEL,
            "n_heads": N_HEADS,
            "aso_len": ASO_LEN,
            "target_len": TARGET_LEN,
            "acc_dim": ACC_DIM,
            "hc_dim": HC_DIM,
            "gate_hidden": 32,
            "hidden_dims": [512, 256, 128, 64],
        },
        "folds": [
            {"fold": i + 1, **fold_results[i]}
            for i in range(N_FOLDS)
        ],
        "pearson_mean": float(np.mean(pearsons)),
        "pearson_sd": float(np.std(pearsons)),
        "r2_mean": float(np.mean(r2s)),
        "r2_sd": float(np.std(r2s)),
        "mse_mean": float(np.mean(mses)),
        "mse_sd": float(np.std(mses)),
        "mae_mean": float(np.mean(maes)),
        "mae_sd": float(np.std(maes)),
    }

    if all_attn:
        avg_attn = np.mean(all_attn, axis=0)
        summary["avg_aso_x_target_attention"] = avg_attn.tolist()
    else:
        avg_attn = None

    return summary, all_train_curves, avg_attn


def save_outputs(summary, train_curves, avg_attn):
    os.makedirs(EXPERIMENT_DIR, exist_ok=True)

    config_out = {
        "experiment": "exp11_token_cross_attention",
        "description": summary["description"],
        "model_type": "token_cross_attention",
        "input_shapes": summary["input_shapes"],
        "embedding_note": (
            "Per-nucleotide RNA-FM token embeddings (no mean pool). "
            "Huesken targets are pre-windowed 57-nt (19 up + 19 binding + 19 down); "
            "fixed lengths -> no padding, no attention mask."
        ),
        "hyperparameters": {
            "learning_rate": LR,
            "dropout": DROPOUT,
            "weight_decay": WEIGHT_DECAY,
            "batch_size": BATCH_SIZE,
            "epochs": EPOCHS,
            "patience": PATIENCE,
            "n_folds": N_FOLDS,
            "seed": SEED,
        },
        "architecture": summary["architecture"],
    }
    with open(os.path.join(EXPERIMENT_DIR, "config.yaml"), "w") as f:
        yaml.dump(config_out, f, default_flow_style=False, sort_keys=False)

    with open(os.path.join(EXPERIMENT_DIR, "metrics.json"), "w") as f:
        json.dump(summary, f, indent=2)

    # Average training curve
    max_epochs = max(len(c) for c in train_curves)
    avg_curve = []
    for ep in range(max_epochs):
        ep_data = {}
        for curve in train_curves:
            if ep < len(curve):
                d = curve[ep]
                for k, v in d.items():
                    if k == "epoch":
                        continue
                    ep_data.setdefault(k, []).append(v)
        if ep_data:
            avg_point = {"epoch": ep + 1}
            for k, vals in ep_data.items():
                avg_point[k] = float(np.mean(vals))
            avg_curve.append(avg_point)

    with open(os.path.join(EXPERIMENT_DIR, "training_curve.json"), "w") as f:
        json.dump(avg_curve, f, indent=2)

    # Training curve plot
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        epochs_range = [p["epoch"] for p in avg_curve]
        train_losses = [p["train_loss"] for p in avg_curve]
        val_losses = [p["val_loss"] for p in avg_curve]
        val_pearsons = [p.get("val_pearson", 0) for p in avg_curve]

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
        ax1.plot(epochs_range, train_losses, label="Train Loss", color="steelblue")
        ax1.plot(epochs_range, val_losses, label="Val Loss", color="darkorange")
        ax1.set_xlabel("Epoch")
        ax1.set_ylabel("MSE Loss")
        ax1.set_title("TokenCrossAttention — Training Curve")
        ax1.legend()

        ax2.plot(epochs_range, val_pearsons, label="Val Pearson", color="green")
        ax2.set_xlabel("Epoch")
        ax2.set_ylabel("Pearson r")
        ax2.set_title("TokenCrossAttention — Validation Pearson")
        ax2.legend()

        plt.tight_layout()
        plt.savefig(os.path.join(EXPERIMENT_DIR, "training_curve.png"), dpi=150)
        plt.close()
    except Exception as e:
        print(f"  Warning: could not generate plot: {e}")

    # ASO-position x target-position cross-attention heatmap
    if avg_attn is not None:
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            import matplotlib.patches as mpatches

            fig, ax = plt.subplots(figsize=(8, 6))
            im = ax.imshow(avg_attn, cmap="viridis", aspect="auto")
            ax.set_title("Token Cross-Attention (ASO positions → target positions)")
            ax.set_xlabel("Target (mRNA) position (nt)")
            ax.set_ylabel("ASO (siRNA) position (nt)")
            ax.set_xticks(range(0, TARGET_LEN, 5))
            ax.set_yticks(range(0, ASO_LEN, 2))

            # Highlight the binding site (target positions 19..38) on the x-axis
            ax.add_patch(mpatches.Rectangle(
                (18.5, -0.5), 19, ASO_LEN, fill=False, edgecolor="red",
                linewidth=1.5, label="binding site (pos 19-37)"
            ))
            ax.legend(loc="upper right")
            fig.colorbar(im, ax=ax)
            plt.tight_layout()
            plt.savefig(os.path.join(EXPERIMENT_DIR, "aso_x_target_attention.png"), dpi=150)
            plt.close()
        except Exception as e:
            print(f"  Warning: could not generate attention plot: {e}")


def main():
    torch.manual_seed(SEED)
    np.random.seed(SEED)

    print("Loading data...")
    aso, mrna, acc, hc, y = load_data()

    print(f"\n{'='*60}")
    print("  TokenCrossAttention (nucleotide-level cross-attention transformer)")
    print(f"{'='*60}")
    summary, curves, avg_attn = run_experiment(aso, mrna, acc, hc, y)
    save_outputs(summary, curves, avg_attn)

    # Comparison against prior models (same protocol, already computed)
    comparison = {
        "rnafm_only": {"pearson_mean": 0.5641, "pearson_sd": 0.0097,
                       "r2_mean": 0.2892, "r2_sd": 0.0158},
        "fusion": {"pearson_mean": 0.5520, "pearson_sd": 0.0183,
                   "r2_mean": 0.2735, "r2_sd": 0.0307},
        "gated": {"pearson_mean": 0.5848, "pearson_sd": 0.0223,
                  "r2_mean": 0.3309, "r2_sd": 0.0288},
        "cross_attention": {"pearson_mean": 0.5843, "pearson_sd": 0.0244,
                            "r2_mean": 0.3261, "r2_sd": 0.0283},
        "token_cross_attention": {
            "pearson_mean": summary["pearson_mean"],
            "pearson_sd": summary["pearson_sd"],
            "r2_mean": summary["r2_mean"],
            "r2_sd": summary["r2_sd"],
        },
    }
    with open(os.path.join(EXPERIMENT_DIR, "comparison.json"), "w") as f:
        json.dump(comparison, f, indent=2)

    print(f"\n{'='*70}")
    print("TOKEN-LEVEL CROSS-ATTENTION — 5-Fold CV Results")
    print(f"{'='*70}")
    print(f"{'Model':<25} {'Pearson':>14} {'R²':>14}")
    print(f"{'-'*25} {'-'*14} {'-'*14}")
    labels = {
        "rnafm_only": "RNA-FM only",
        "fusion": "FusionNet",
        "gated": "GatedFusionNet",
        "cross_attention": "CrossAttentionFusion (feat-level)",
        "token_cross_attention": "TokenCrossAttention (nt-level)",
    }
    for name in ["rnafm_only", "fusion", "gated", "cross_attention", "token_cross_attention"]:
        r = comparison[name]
        print(f"{labels[name]:<25} "
              f"{r['pearson_mean']:>7.4f} ± {r['pearson_sd']:<4.4f}  "
              f"{r['r2_mean']:>7.4f} ± {r['r2_sd']:<4.4f}")
    print(f"{'-'*25} {'-'*14} {'-'*14}")

    delta = summary["pearson_mean"] - comparison["gated"]["pearson_mean"]
    print(f"\n  Δ vs GatedFusionNet: {delta:+.4f} Pearson")
    print(f"\nResults saved to {EXPERIMENT_DIR}/")


if __name__ == "__main__":
    main()
