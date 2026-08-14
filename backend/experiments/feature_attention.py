"""Feature Attention (Gated Fusion) Experiment.

Tests whether a gated fusion mechanism — where each feature family
gets a learned attention weight — improves over simple concatenation.

Compares:
  • FusionNet (plain concatenation + MLP)
  • GatedFusionNet (per-family attention gates + MLP)

Both use identical training protocol: 5-fold CV, same hyperparameters.
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
from backend.models.fusion import FusionNet
from backend.models.gated_fusion import GatedFusionNet
from backend.features.embed_cache import CACHE_FILE
from backend.datasets.ablation_dataset import (
    HANDSCRFTED_KEYS,
    ACCESSIBILITY_KEYS,
    HANDSCRFTED_DIM,
    ACCESSIBILITY_DIM,
    RNAFM_DIM,
    auto_architecture,
)

N_FOLDS = 5
SEED = 42
EPOCHS = 100
PATIENCE = 10
LR = 1e-3
WEIGHT_DECAY = 1e-5
BATCH_SIZE = 32
DROPOUT = 0.2

EXPERIMENT_DIR = "backend/experiments/exp09_feature_attention"
FAMILY_DIMS = [640, 640, 11, 9]  # siRNA, mRNA, accessibility, handcrafted
FAMILY_NAMES = ["rnafm_siRNA", "rnafm_mRNA", "accessibility", "handcrafted"]


def pearson_corr(preds, targets):
    if preds.std() == 0 or targets.std() == 0:
        return 0.0
    return np.corrcoef(preds, targets)[0, 1]


def load_data():
    """Load full feature tensor from cache + handcrafted features."""
    data = torch.load(CACHE_FILE, weights_only=True)
    embeddings = data["embeddings"]
    accessibility = data["accessibility"]
    labels = data["labels"]

    base = HueskenDataset("OligoFormer/data/Hu.csv")
    n = len(base)
    handcrafted = torch.zeros(n, HANDSCRFTED_DIM, dtype=torch.float32)
    for i in range(n):
        feats = base[i]["features"]
        handcrafted[i] = torch.tensor(
            [feats[k] for k in HANDSCRFTED_KEYS], dtype=torch.float32
        )

    X = torch.cat([embeddings, accessibility, handcrafted], dim=1)
    y = labels
    print(f"Loaded {n} samples, input dim={X.shape[1]}")
    return X, y


def train_one_fold(X_train, y_train, X_val, y_val, model_type, input_dim, seed):
    """Train a single fold. Returns (model, train_curve, best_val_loss)."""
    torch.manual_seed(seed)
    np.random.seed(seed)

    if model_type == "fusion":
        hidden_dims = auto_architecture(input_dim)
        model = FusionNet(
            input_dim=input_dim,
            hidden_dims=hidden_dims,
            dropout=DROPOUT,
        )
    else:
        model = GatedFusionNet(
            family_dims=FAMILY_DIMS,
            hidden_dims=[512, 256, 128, 64],
            gate_hidden=32,
            proj_dim=128,
            dropout=DROPOUT,
        )

    optimizer = torch.optim.Adam(
        model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY
    )
    loss_fn = torch.nn.MSELoss()

    n_train = len(X_train)
    train_curve = []
    best_val_loss = float("inf")
    patience_counter = 0
    best_model_state = None
    best_gate_weights = None

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
            pred = model(X_train[idx])
            loss = loss_fn(pred, y_train[idx])
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()
            n_batches += 1
            all_train_preds.append(pred.detach().numpy())
            all_train_targets.append(y_train[idx].numpy())

        model.eval()
        with torch.no_grad():
            val_pred = model(X_val)
            val_loss = loss_fn(val_pred, y_val)

        avg_train_loss = epoch_loss / max(n_batches, 1)
        train_preds = np.concatenate(all_train_preds).flatten() if all_train_preds else np.array([])
        train_targets = np.concatenate(all_train_targets).flatten() if all_train_targets else np.array([])
        train_pearson = pearson_corr(train_preds, train_targets) if len(train_preds) > 1 else 0.0
        val_pearson = pearson_corr(val_pred.numpy(), y_val.numpy()) if len(val_pred) > 1 else 0.0

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
            # Save gate weights at best epoch
            if model_type == "gated":
                best_gate_weights = model.get_gate_weights(X_val).detach().cpu().numpy()
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE:
                break

    if best_model_state is not None:
        model.load_state_dict(best_model_state)

    return model, train_curve, best_val_loss, best_gate_weights


def evaluate(model, X, y):
    model.eval()
    with torch.no_grad():
        preds = model(X).squeeze(-1)

    preds_np = preds.numpy()
    targets_np = y.numpy()

    mse = np.mean((preds_np - targets_np) ** 2)
    mae = np.mean(np.abs(preds_np - targets_np))
    pearson = pearson_corr(preds_np, targets_np) if preds_np.std() > 0 else 0.0
    ss_res = np.sum((targets_np - preds_np) ** 2)
    ss_tot = np.sum((targets_np - targets_np.mean()) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return {
        "pearson": float(pearson),
        "r2": float(r2),
        "mse": float(mse),
        "mae": float(mae),
    }


def run_experiment(model_type, X, y, input_dim):
    """Run 5-fold CV for a given model type."""
    indices = np.arange(len(X))
    kf = KFold(n_splits=N_FOLDS, shuffle=True, random_state=SEED)

    fold_results = []
    all_train_curves = []
    all_gate_weights = []

    for fold_idx, (train_idx, val_idx) in enumerate(kf.split(indices)):
        print(f"  Fold {fold_idx + 1}/{N_FOLDS}...", end=" ", flush=True)

        X_train = X[train_idx]
        y_train = y[train_idx]
        X_val = X[val_idx]
        y_val = y[val_idx]

        model, train_curve, best_val_loss, gate_weights = train_one_fold(
            X_train, y_train, X_val, y_val, model_type, input_dim, seed=SEED + fold_idx
        )

        metrics = evaluate(model, X_val, y_val)
        fold_results.append(metrics)
        all_train_curves.append(train_curve)
        if gate_weights is not None:
            all_gate_weights.append(gate_weights)

        print(f"Pearson={metrics['pearson']:.4f}  R²={metrics['r2']:.4f}  "
              f"MSE={metrics['mse']:.4f}  (val_loss={best_val_loss:.4f})")

    pearsons = [r["pearson"] for r in fold_results]
    r2s = [r["r2"] for r in fold_results]
    mses = [r["mse"] for r in fold_results]
    maes = [r["mae"] for r in fold_results]

    summary = {
        "model_type": model_type,
        "input_dim": input_dim,
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

    if all_gate_weights:
        avg_gates = np.mean(
            [gw.mean(axis=0) for gw in all_gate_weights], axis=0
        )
        summary["avg_gate_weights"] = {
            FAMILY_NAMES[j]: float(avg_gates[j])
            for j in range(len(FAMILY_NAMES))
        }

    return summary, all_train_curves


def save_experiment_outputs(model_type, summary, train_curves):
    """Save all experiment artifacts."""
    os.makedirs(EXPERIMENT_DIR, exist_ok=True)
    exp_subdir = os.path.join(EXPERIMENT_DIR, model_type)
    os.makedirs(exp_subdir, exist_ok=True)

    config_out = {
        "experiment": f"feature_attention_{model_type}",
        "description": "GatedFusionNet with per-family attention" if model_type == "gated"
                        else "FusionNet baseline (plain concatenation)",
        "model_type": model_type,
        "input_dim": summary["input_dim"],
        "family_dims": FAMILY_DIMS if model_type == "gated" else None,
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
        "architecture": (
            {"hidden_dims": auto_architecture(1300), "dropout": DROPOUT}
            if model_type == "fusion"
            else {
                "family_dims": FAMILY_DIMS,
                "proj_dim": 128,
                "gate_hidden": 32,
                "hidden_dims": [512, 256, 128, 64],
            }
        ),
        "avg_gate_weights": summary.get("avg_gate_weights", None),
    }
    with open(os.path.join(exp_subdir, "config.yaml"), "w") as f:
        yaml.dump(config_out, f, default_flow_style=False, sort_keys=False)

    with open(os.path.join(exp_subdir, "metrics.json"), "w") as f:
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

    with open(os.path.join(exp_subdir, "training_curve.json"), "w") as f:
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
        title = "FusionNet" if model_type == "fusion" else "GatedFusionNet"
        ax1.set_title(f"{title} — Training Curve")
        ax1.legend()

        ax2.plot(epochs_range, val_pearsons, label="Val Pearson", color="green")
        ax2.set_xlabel("Epoch")
        ax2.set_ylabel("Pearson r")
        ax2.set_title(f"{title} — Validation Pearson")
        ax2.legend()

        plt.tight_layout()
        plt.savefig(os.path.join(exp_subdir, "training_curve.png"), dpi=150)
        plt.close()
    except Exception as e:
        print(f"  Warning: could not generate plot: {e}")

    # Save a dummy model checkpoint
    torch.save({"model_type": model_type, "input_dim": summary["input_dim"]},
               os.path.join(exp_subdir, "best_model.pt"))


def main():
    torch.manual_seed(SEED)
    np.random.seed(SEED)

    print("Loading data...")
    X, y = load_data()

    results = {}

    # Run FusionNet (baseline for comparison)
    print(f"\n{'='*60}")
    print(f"  FusionNet (plain concatenation)")
    print(f"{'='*60}")
    summary_fusion, curves_fusion = run_experiment("fusion", X, y, 1300)
    results["fusion"] = summary_fusion
    save_experiment_outputs("fusion", summary_fusion, curves_fusion)

    # Run GatedFusionNet
    print(f"\n{'='*60}")
    print(f"  GatedFusionNet (feature-family attention)")
    print(f"{'='*60}")
    summary_gated, curves_gated = run_experiment("gated", X, y, 1300)
    results["gated"] = summary_gated
    save_experiment_outputs("gated", summary_gated, curves_gated)

    # --- Print comparison table ---
    print(f"\n{'='*70}")
    print(f"FEATURE ATTENTION — 5-Fold CV Results")
    print(f"{'='*70}")
    print(f"{'Model':<25} {'Pearson':>14} {'R²':>14}")
    print(f"{'-'*25} {'-'*14} {'-'*14}")
    for name, r in results.items():
        label = "FusionNet" if name == "fusion" else "GatedFusionNet"
        print(f"{label:<25} "
              f"{r['pearson_mean']:>7.4f} ± {r['pearson_sd']:<4.4f}  "
              f"{r['r2_mean']:>7.4f} ± {r['r2_sd']:<4.4f}")
    print(f"{'-'*25} {'-'*14} {'-'*14}")

    # Gate weights analysis
    if "avg_gate_weights" in results["gated"]:
        print(f"\n  GatedFusionNet average gate weights:")
        total = sum(results["gated"]["avg_gate_weights"].values())
        for fam, val in results["gated"]["avg_gate_weights"].items():
            pct = (val / total * 100) if total > 0 else 0
            print(f"    {fam:20s}: {val:.4f}  ({pct:.1f}%)")

    # Save comparison
    os.makedirs(EXPERIMENT_DIR, exist_ok=True)

    comparison = {
        "fusion": {
            "pearson_mean": results["fusion"]["pearson_mean"],
            "pearson_sd": results["fusion"]["pearson_sd"],
            "r2_mean": results["fusion"]["r2_mean"],
            "r2_sd": results["fusion"]["r2_sd"],
        },
        "gated": {
            "pearson_mean": results["gated"]["pearson_mean"],
            "pearson_sd": results["gated"]["pearson_sd"],
            "r2_mean": results["gated"]["r2_mean"],
            "r2_sd": results["gated"]["r2_sd"],
            "avg_gate_weights": results["gated"].get("avg_gate_weights", {}),
        },
    }

    with open(os.path.join(EXPERIMENT_DIR, "comparison.json"), "w") as f:
        json.dump(comparison, f, indent=2)

    md = "| Model | Pearson | R² |\n|-------|---------|-----|\n"
    md += f"| FusionNet | {results['fusion']['pearson_mean']:.4f} ± {results['fusion']['pearson_sd']:.4f} | {results['fusion']['r2_mean']:.4f} ± {results['fusion']['r2_sd']:.4f} |\n"
    md += f"| GatedFusionNet | {results['gated']['pearson_mean']:.4f} ± {results['gated']['pearson_sd']:.4f} | {results['gated']['r2_mean']:.4f} ± {results['gated']['r2_sd']:.4f} |\n"
    with open(os.path.join(EXPERIMENT_DIR, "comparison_table.md"), "w") as f:
        f.write(md)

    # Improvement analysis
    delta_pearson = results["gated"]["pearson_mean"] - results["fusion"]["pearson_mean"]
    delta_r2 = results["gated"]["r2_mean"] - results["fusion"]["r2_mean"]
    print(f"\n  Improvement: ΔPearson = {delta_pearson:+.4f}, ΔR² = {delta_r2:+.4f}")

    print(f"\nResults saved to {EXPERIMENT_DIR}/")


if __name__ == "__main__":
    main()
