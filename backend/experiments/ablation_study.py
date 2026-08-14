"""Ablation study: train FusionNet with different feature subsets
and compare cross-validated performance.

Experiments
-----------
1. exp01_handcrafted           — GC, AU, Length, ViennaRNA
2. exp02_rnafm                 — 1280-dim RNA-FM embeddings
3. exp03_accessibility         — 11-dim accessibility features
4. exp04_rnafm_accessibility   — RNA-FM + accessibility
5. exp05_rnafm_handcrafted     — RNA-FM + handcrafted
6. exp06_fusion                — Everything (current FusionNet)

All experiments use the same training protocol:
  • 5-fold CV (seed=42, shuffle=True)
  • Adam optimizer, MSE loss, early stopping (patience=10)
  • Best hyperparameters from HPO: lr=1e-3, dropout=0.2, weight_decay=1e-5
  • Architecture auto-scaled based on input dimension
"""

import os
import sys
import json
import numpy as np
import torch
import yaml

from sklearn.model_selection import KFold

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.datasets.huesken import HueskenDataset
from backend.datasets.ablation_dataset import AblationDataset, ABLATED_EXPERIMENTS, auto_architecture
from backend.models.fusion import FusionNet
from backend.features.embed_cache import CACHE_FILE

CONFIG_PATH = "backend/config/config.yaml"
N_FOLDS = 5
SEED = 42
EPOCHS = 100
PATIENCE = 10
LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-5
BATCH_SIZE = 32
DROPOUT = 0.2

EXPERIMENT_BASE_DIR = "backend/experiments"


def pearson_corr(preds, targets):
    if preds.std() == 0 or targets.std() == 0:
        return 0.0
    return np.corrcoef(preds, targets)[0, 1]


def load_cache(dataset):
    """Pre-load the full dataset tensors for fast iteration."""
    n = len(dataset)
    sample_x, _ = dataset[0]
    dim = sample_x.shape[0]
    X = torch.zeros(n, dim, dtype=torch.float32)
    y = torch.zeros(n, dtype=torch.float32)
    for i in range(n):
        x_i, y_i = dataset[i]
        X[i] = x_i
        y[i] = y_i
    return X, y


def train_one_fold(X_train, y_train, X_val, y_val, input_dim, seed=SEED):
    """Train a single fold. Returns (model, train_curve)."""
    torch.manual_seed(seed)
    np.random.seed(seed)

    hidden_dims = auto_architecture(input_dim)

    model = FusionNet(
        input_dim=input_dim,
        hidden_dims=hidden_dims,
        dropout=DROPOUT,
    )
    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY,
    )
    loss_fn = torch.nn.MSELoss()

    n_train = len(X_train)
    train_curve = []

    best_val_loss = float("inf")
    patience_counter = 0
    best_model_state = None

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
            X_batch = X_train[idx]
            y_batch = y_train[idx]
            pred = model(X_batch)
            loss = loss_fn(pred, y_batch)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()
            n_batches += 1
            all_train_preds.append(pred.detach().numpy())
            all_train_targets.append(y_batch.numpy())

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
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE:
                break

    if best_model_state is not None:
        model.load_state_dict(best_model_state)

    return model, train_curve, best_val_loss


def evaluate(model, X, y):
    model.eval()
    with torch.no_grad():
        preds = model(X).squeeze(-1)

    preds_np = preds.numpy()
    targets_np = y.numpy()

    mse = np.mean((preds_np - targets_np) ** 2)
    mae = np.mean(np.abs(preds_np - targets_np))

    if preds_np.std() == 0 or targets_np.std() == 0:
        pearson = 0.0
    else:
        pearson = np.corrcoef(preds_np, targets_np)[0, 1]

    ss_res = np.sum((targets_np - preds_np) ** 2)
    ss_tot = np.sum((targets_np - targets_np.mean()) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return {
        "pearson": float(pearson),
        "r2": float(r2),
        "mse": float(mse),
        "mae": float(mae),
    }


def run_experiment(exp_name, exp_config, base_dataset):
    """Run a single ablation experiment with 5-fold CV."""
    print(f"\n{'='*60}")
    print(f"  {exp_name}: {exp_config['description']}")
    print(f"{'='*60}")

    feature_families = exp_config["feature_families"]
    dataset = AblationDataset(
        base_dataset,
        cache_path=CACHE_FILE,
        feature_families=feature_families,
    )

    input_dim = dataset.input_dim
    expected_dim = exp_config["input_dim"]
    assert input_dim == expected_dim, (
        f"Expected dim {expected_dim} but got {input_dim}"
    )

    print(f"  Input dim: {input_dim}")
    print(f"  Architecture: {auto_architecture(input_dim)}")

    # Pre-load all data into tensors
    X, y = load_cache(dataset)
    print(f"  Dataset: {len(X)} samples")

    # CV
    indices = np.arange(len(X))
    kf = KFold(n_splits=N_FOLDS, shuffle=True, random_state=SEED)

    fold_results = []
    all_train_curves = []

    for fold_idx, (train_idx, val_idx) in enumerate(kf.split(indices)):
        print(f"  Fold {fold_idx + 1}/{N_FOLDS}...", end=" ", flush=True)

        X_train = X[train_idx]
        y_train = y[train_idx]
        X_val = X[val_idx]
        y_val = y[val_idx]

        model, train_curve, best_val_loss = train_one_fold(
            X_train, y_train, X_val, y_val, input_dim, seed=SEED + fold_idx
        )

        metrics = evaluate(model, X_val, y_val)
        fold_results.append(metrics)
        all_train_curves.append(train_curve)

        print(f"Pearson={metrics['pearson']:.4f}  R²={metrics['r2']:.4f}  "
              f"MSE={metrics['mse']:.4f}  (val_loss={best_val_loss:.4f})")

    # Aggregate
    pearsons = [r["pearson"] for r in fold_results]
    r2s = [r["r2"] for r in fold_results]
    mses = [r["mse"] for r in fold_results]
    maes = [r["mae"] for r in fold_results]

    summary = {
        "experiment": exp_name,
        "description": exp_config["description"],
        "feature_families": feature_families,
        "input_dim": input_dim,
        "architecture": auto_architecture(input_dim),
        "folds": [
            {
                "fold": i + 1,
                "pearson": r["pearson"],
                "r2": r["r2"],
                "mse": r["mse"],
                "mae": r["mae"],
            }
            for i, r in enumerate(fold_results)
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

    # Save experiment outputs
    exp_dir = os.path.join(EXPERIMENT_BASE_DIR, exp_name)
    os.makedirs(exp_dir, exist_ok=True)

    config_out = {
        "experiment": exp_name,
        "description": exp_config["description"],
        "feature_families": feature_families,
        "input_dim": input_dim,
        "hyperparameters": {
            "learning_rate": LEARNING_RATE,
            "dropout": DROPOUT,
            "weight_decay": WEIGHT_DECAY,
            "batch_size": BATCH_SIZE,
            "epochs": EPOCHS,
            "patience": PATIENCE,
            "n_folds": N_FOLDS,
            "seed": SEED,
        },
        "architecture": auto_architecture(input_dim),
        "results": {
            "pearson_mean": summary["pearson_mean"],
            "pearson_sd": summary["pearson_sd"],
            "r2_mean": summary["r2_mean"],
            "r2_sd": summary["r2_sd"],
        },
    }
    with open(os.path.join(exp_dir, "config.yaml"), "w") as f:
        yaml.dump(config_out, f, default_flow_style=False, sort_keys=False)

    with open(os.path.join(exp_dir, "metrics.json"), "w") as f:
        json.dump(summary, f, indent=2)

    # Training curve (average across folds)
    avg_curve = []
    max_epochs = max(len(c) for c in all_train_curves)
    for ep in range(max_epochs):
        ep_data = {}
        for curve in all_train_curves:
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

    with open(os.path.join(exp_dir, "training_curve.json"), "w") as f:
        json.dump(avg_curve, f, indent=2)

    # Plot training curve
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
        ax1.set_title(f"{exp_name} — Training Curve")
        ax1.legend()

        ax2.plot(epochs_range, val_pearsons, label="Val Pearson", color="green")
        ax2.set_xlabel("Epoch")
        ax2.set_ylabel("Pearson r")
        ax2.set_title(f"{exp_name} — Validation Pearson")
        ax2.legend()

        plt.tight_layout()
        plt.savefig(os.path.join(exp_dir, "training_curve.png"), dpi=150)
        plt.close()
    except Exception as e:
        print(f"  Warning: could not generate plot: {e}")

    # Save last fold's model as checkpoint
    torch.save({"input_dim": input_dim, "architecture": auto_architecture(input_dim)},
               os.path.join(exp_dir, "best_model.pt"))

    return summary


def main():
    torch.manual_seed(SEED)
    np.random.seed(SEED)

    print("Loading Huesken dataset...")
    base_dataset = HueskenDataset("OligoFormer/data/Hu.csv")
    print(f"  Total samples: {len(base_dataset)}")

    if not os.path.exists(CACHE_FILE):
        print(f"Cache not found at {CACHE_FILE}. Run embed_cache precompute first.")
        return

    all_results = []

    for exp_name, exp_config in ABLATED_EXPERIMENTS.items():
        result = run_experiment(exp_name, exp_config, base_dataset)
        all_results.append(result)

    # Final summary table
    print(f"\n{'='*70}")
    print(f"ABLATION STUDY — 5-Fold Cross-Validation Results")
    print(f"{'='*70}")
    print(f"{'Model':<30} {'Pearson':>14} {'R²':>14}")
    print(f"{'-'*30} {'-'*14} {'-'*14}")
    for r in all_results:
        print(f"{r['description'][:28]:<30} "
              f"{r['pearson_mean']:>7.4f} ± {r['pearson_sd']:<4.4f}  "
              f"{r['r2_mean']:>7.4f} ± {r['r2_sd']:<4.4f}")
    print(f"{'-'*30} {'-'*14} {'-'*14}")
    print()

    # Save aggregated results
    agg_dir = os.path.join(EXPERIMENT_BASE_DIR, "exp06_ablation")
    os.makedirs(agg_dir, exist_ok=True)

    table_rows = []
    for r in all_results:
        table_rows.append({
            "model": r["description"],
            "pearson_mean": round(r["pearson_mean"], 4),
            "pearson_sd": round(r["pearson_sd"], 4),
            "r2_mean": round(r["r2_mean"], 4),
            "r2_sd": round(r["r2_sd"], 4),
        })

    with open(os.path.join(agg_dir, "ablation_results.json"), "w") as f:
        json.dump(table_rows, f, indent=2)

    # Markdown table
    md = "| Model | Pearson | R² |\n"
    md += "|-------|---------|-----|\n"
    for r in all_results:
        md += f"| {r['description']} | {r['pearson_mean']:.4f} ± {r['pearson_sd']:.4f} | {r['r2_mean']:.4f} ± {r['r2_sd']:.4f} |\n"

    with open(os.path.join(agg_dir, "ablation_table.md"), "w") as f:
        f.write(md)

    # Save full results
    with open(os.path.join(agg_dir, "full_results.json"), "w") as f:
        json.dump(all_results, f, indent=2)

    print(f"Results saved to {agg_dir}/")
    print(f"  - ablation_results.json")
    print(f"  - ablation_table.md")
    print(f"  - full_results.json")


if __name__ == "__main__":
    main()
