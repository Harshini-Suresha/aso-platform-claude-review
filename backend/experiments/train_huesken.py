"""Train FusionNet on the Huesken (Hu.csv) dataset and save all
artifacts required for the paper.

Outputs (under backend/results/Huesken/):
    metrics.json         aggregate CV metrics + best-fold details
    predictions.csv      out-of-fold Sample / True / Predicted
    learning_curve.png   best-fold train/val loss + val Pearson curve
    scatter_plot.png     predicted vs true efficacy (with diagonal)
    training_log.csv     per-epoch logs of the best fold
    confusion.txt        binary confusion matrix / classification report
    best_model.pt        best fold's model state_dict

Also writes:
    backend/results/cv_results.csv  per-fold + mean / SD summary
    backend/models/fusion_best.pt   best model + config.yaml
    backend/models/config.yaml      config used to train the best model
"""

import json
import os
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch
import yaml
from sklearn.metrics import confusion_matrix, classification_report, accuracy_score
from sklearn.model_selection import KFold
from torch.utils.data import DataLoader

from backend.config import load_config
from backend.datasets.huesken import HueskenDataset
from backend.datasets.torch_dataset import ASOFusedDataset
from backend.features.embed_cache import CACHE_FILE
from backend.models.fusion import FusionNet

CONFIG_PATH = "backend/config/config.yaml"
RESULTS_DIR = "backend/results"
HUEKEN_DIR = os.path.join(RESULTS_DIR, "Huesken")
MODELS_DIR = "backend/models"
N_FOLDS = 5


def pearson_corr(preds, targets):
    if preds.std() == 0 or targets.std() == 0:
        return 0.0
    return float(np.corrcoef(preds, targets)[0, 1])


def compute_metrics(preds, targets):
    preds = np.asarray(preds, dtype=np.float64)
    targets = np.asarray(targets, dtype=np.float64)
    mse = float(np.mean((preds - targets) ** 2))
    mae = float(np.mean(np.abs(preds - targets)))
    pearson = pearson_corr(preds, targets)
    ss_res = np.sum((targets - preds) ** 2)
    ss_tot = np.sum((targets - targets.mean()) ** 2)
    r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0
    return {
        "pearson": pearson,
        "r2": r2,
        "mse": mse,
        "mae": mae,
    }


def train_one_fold(train_loader, val_loader, model_cfg, train_cfg, fold_idx):
    """Train a single fold with early stopping.

    Returns (model, fold_epoch_log, n_epochs_trained, best_val_pearson, best_val_state)
    """
    model = FusionNet(
        input_dim=model_cfg["input_dim"],
        hidden_dims=model_cfg["hidden_dims"],
        dropout=model_cfg["dropout"],
    )
    lr = train_cfg["learning_rate"]
    weight_decay = train_cfg.get("weight_decay", 0.0)
    optimizer = torch.optim.Adam(
        model.parameters(), lr=lr, weight_decay=weight_decay
    )
    loss_fn = torch.nn.MSELoss()

    epochs = train_cfg["epochs"]
    patience = train_cfg.get("patience", 10)
    best_val_loss = float("inf")
    best_val_pearson = -1.0
    patience_counter = 0
    best_model_state = None

    epoch_log = []

    print(
        f"  [Fold {fold_idx}] FusionNet(input_dim={model_cfg['input_dim']}, "
        f"hidden={model_cfg['hidden_dims']}, lr={lr}, wd={weight_decay})"
    )

    for epoch in range(epochs):
        # ---- train ----
        model.train()
        epoch_loss = 0.0
        n_batches = 0
        all_train_preds = []
        all_train_targets = []
        for X, y in train_loader:
            pred = model(X)
            loss = loss_fn(pred, y)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()
            n_batches += 1
            all_train_preds.append(pred.detach().numpy())
            all_train_targets.append(y.numpy())

        train_preds = np.concatenate(all_train_preds)
        train_targets = np.concatenate(all_train_targets)

        # ---- validate ----
        model.eval()
        val_loss = 0.0
        n_val_batches = 0
        all_val_preds = []
        all_val_targets = []
        with torch.no_grad():
            for X, y in val_loader:
                pred = model(X)
                loss = loss_fn(pred, y)
                val_loss += loss.item()
                n_val_batches += 1
                all_val_preds.append(pred.numpy())
                all_val_targets.append(y.numpy())

        val_preds = np.concatenate(all_val_preds)
        val_targets = np.concatenate(all_val_targets)

        avg_train_loss = epoch_loss / max(n_batches, 1)
        avg_val_loss = val_loss / max(n_val_batches, 1)
        train_pearson = pearson_corr(train_preds, train_targets)
        val_pearson = pearson_corr(val_preds, val_targets)

        epoch_log.append(
            {
                "epoch": epoch + 1,
                "train_loss": avg_train_loss,
                "val_loss": avg_val_loss,
                "train_pearson": train_pearson,
                "val_pearson": val_pearson,
            }
        )

        if epoch < 3 or (epoch + 1) % 10 == 0 or epoch == epochs - 1:
            print(
                f"  Fold {fold_idx} | Epoch {epoch+1:3d}/{epochs} | "
                f"train MSE {avg_train_loss:.4f} | val MSE {avg_val_loss:.4f} | "
                f"val Pearson {val_pearson:.4f}"
            )

        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            best_val_pearson = val_pearson if val_pearson > best_val_pearson else best_val_pearson
            patience_counter = 0
            best_model_state = {k: v.clone() for k, v in model.state_dict().items()}
            best_val_preds = val_preds.copy()
            best_val_targets = val_targets.copy()
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(
                    f"  Fold {fold_idx} early stop @ epoch {epoch+1} "
                    f"(best val MSE {best_val_loss:.4f}, best val Pearson {best_val_pearson:.4f})"
                )
                break

    n_epochs_trained = len(epoch_log)
    if best_model_state is not None:
        model.load_state_dict(best_model_state)

    return model, epoch_log, n_epochs_trained, best_val_pearson, best_val_preds, best_val_targets


def plot_learning_curve(epoch_log, path, fold_idx):
    epochs_range = [p["epoch"] for p in epoch_log]
    train_losses = [p["train_loss"] for p in epoch_log]
    val_losses = [p["val_loss"] for p in epoch_log]
    val_pearsons = [p["val_pearson"] for p in epoch_log]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
    ax1.plot(epochs_range, train_losses, label="Train Loss", color="steelblue")
    ax1.plot(epochs_range, val_losses, label="Validation Loss", color="darkorange")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("MSE Loss")
    ax1.set_title(f"FusionNet — Training Curve (Fold {fold_idx})")
    ax1.legend()

    ax2.plot(epochs_range, val_pearsons, label="Val Pearson", color="green")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Pearson r")
    ax2.set_title(f"Validation Pearson (Fold {fold_idx})")
    ax2.legend()

    plt.tight_layout()
    plt.savefig(path, dpi=150)
    plt.close()


def plot_scatter(true_vals, pred_vals, path):
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.scatter(true_vals, pred_vals, s=12, alpha=0.5, color="steelblue", edgecolors="none")
    lims = [
        min(float(np.min(true_vals)), float(np.min(pred_vals))),
        max(float(np.max(true_vals)), float(np.max(pred_vals))),
    ]
    ax.plot(lims, lims, "r--", linewidth=1.5, label="Perfect prediction")
    ax.set_xlim(lims)
    ax.set_ylim(lims)
    ax.set_xlabel("True efficacy")
    ax.set_ylabel("Predicted efficacy")
    ax.set_title("FusionNet — Predicted vs True Efficacy")
    ax.legend()
    plt.tight_layout()
    plt.savefig(path, dpi=150)
    plt.close()


def main():
    os.makedirs(HUEKEN_DIR, exist_ok=True)
    os.makedirs(MODELS_DIR, exist_ok=True)

    config = load_config(CONFIG_PATH)
    data_cfg = config["data"]
    model_cfg = config["model"]
    train_cfg = config["train"]
    paths = config["paths"]

    print(f"Model: {model_cfg['type']}  input_dim={model_cfg['input_dim']}")
    print(f"Data CSV: {data_cfg['csv_path']}")

    # ---- dataset (uses precomputed embeddings cache) ----
    full_dataset = HueskenDataset(data_cfg["csv_path"])
    cache_path = CACHE_FILE
    if not os.path.exists(cache_path):
        print(f"No embedding cache found at {cache_path}. Run embed_cache.precompute_embeddings() first.")
        return
    aso_dataset = ASOFusedDataset(full_dataset, cache_path=cache_path)
    print(f"Dataset size: {len(aso_dataset)}  input_dim={aso_dataset[0][0].shape[0]}")

    # binary labels (ground truth) from the raw CSV, aligned to dataset order
    df = full_dataset.df
    binary_labels = df["y"].to_numpy(dtype=int)

    # the boundary used to derive `y` from `label`:
    # y=0 when label <= 0.5213..., y=1 when label >= 0.5220...
    threshold = 0.5

    n = len(aso_dataset)
    indices = np.arange(n)
    kf = KFold(n_splits=N_FOLDS, shuffle=True, random_state=data_cfg["seed"])

    fold_results = []
    oof_preds = np.zeros(n, dtype=np.float64)
    oof_targets = np.zeros(n, dtype=np.float64)
    oof_binary = np.zeros(n, dtype=int)
    oof_binary_pred = np.zeros(n, dtype=int)

    all_epoch_logs = []
    best_fold = None
    best_fold_pearson = -1.0
    best_fold_log = None
    best_fold_preds = None
    best_fold_targets = None
    best_fold_model_state = None
    best_fold_n_epochs = None

    torch.manual_seed(data_cfg["seed"])

    for fold_idx, (train_idx, val_idx) in enumerate(kf.split(indices)):
        print(f"\n{'='*60}")
        print(f"Fold {fold_idx + 1}/{N_FOLDS} — Training...")
        print(f"{'='*60}")

        train_subset = torch.utils.data.Subset(aso_dataset, train_idx)
        val_subset = torch.utils.data.Subset(aso_dataset, val_idx)

        train_loader = DataLoader(
            train_subset,
            batch_size=train_cfg["batch_size"],
            shuffle=True,
            drop_last=True,
        )
        val_loader = DataLoader(
            val_subset,
            batch_size=train_cfg["batch_size"],
            shuffle=False,
        )

        model, epoch_log, n_epochs, val_pearson, val_preds, val_targets = train_one_fold(
            train_loader, val_loader, model_cfg, train_cfg, fold_idx + 1
        )

        m = compute_metrics(val_preds, val_targets)
        fold_results.append(
            {
                "fold": fold_idx + 1,
                "pearson": m["pearson"],
                "r2": m["r2"],
                "mse": m["mse"],
                "mae": m["mae"],
                "epochs": n_epochs,
            }
        )

        # out-of-fold bookkeeping
        oof_preds[val_idx] = val_preds
        oof_targets[val_idx] = val_targets
        oof_binary[val_idx] = binary_labels[val_idx]
        oof_binary_pred[val_idx] = (val_preds >= threshold).astype(int)

        all_epoch_logs.append(epoch_log)

        if val_pearson > best_fold_pearson:
            best_fold_pearson = val_pearson
            best_fold = fold_idx + 1
            best_fold_log = epoch_log
            best_fold_preds = val_preds
            best_fold_targets = val_targets
            best_fold_model_state = model.state_dict()
            best_fold_n_epochs = n_epochs
            best_fold_val_idx = val_idx.copy()

        print(
            f"  Fold {fold_idx+1} done | Pearson {m['pearson']:.4f} | "
            f"R² {m['r2']:.4f} | MSE {m['mse']:.4f} | epochs {n_epochs}"
        )

    # ---------------- aggregate metrics ----------------
    pearson_vals = [r["pearson"] for r in fold_results]
    r2_vals = [r["r2"] for r in fold_results]
    mse_vals = [r["mse"] for r in fold_results]
    mae_vals = [r["mae"] for r in fold_results]

    print(f"\n{'='*60}")
    print(f"5-Fold Cross-Validation Summary")
    print(f"{'='*60}")
    print(f"{'Fold':<6} {'Pearson':>10} {'R²':>10} {'MSE':>10} {'MAE':>10} {'Epochs':>8}")
    print("-" * 58)
    for r in fold_results:
        print(
            f"{r['fold']:<6} {r['pearson']:>10.4f} {r['r2']:>10.4f} "
            f"{r['mse']:>10.4f} {r['mae']:>10.4f} {r['epochs']:>8}"
        )
    print("-" * 58)
    print(
        f"Mean  {np.mean(pearson_vals):>10.4f} {np.mean(r2_vals):>10.4f} "
        f"{np.mean(mse_vals):>10.4f} {np.mean(mae_vals):>10.4f} {np.mean([r['epochs'] for r in fold_results]):>8.0f}"
    )
    print(
        f"SD    {np.std(pearson_vals):>10.4f} {np.std(r2_vals):>10.4f} "
        f"{np.std(mse_vals):>10.4f} {np.std(mae_vals):>10.4f}"
    )

    oof_metrics = compute_metrics(oof_preds, oof_targets)

    metrics = {
        "dataset": "Huesken",
        "samples": int(n),
        "model": "FusionNet",
        "folds": N_FOLDS,
        "pearson": round(float(np.mean(pearson_vals)), 4),
        "pearson_sd": round(float(np.std(pearson_vals)), 4),
        "r2": round(float(np.mean(r2_vals)), 4),
        "r2_sd": round(float(np.std(r2_vals)), 4),
        "mse": round(float(np.mean(mse_vals)), 4),
        "mae": round(float(np.mean(mae_vals)), 4),
        "epochs": int(best_fold_n_epochs),
        "best_fold": int(best_fold),
        "best_fold_pearson": round(float(best_fold_pearson), 4),
        "oof_pearson": round(float(oof_metrics["pearson"]), 4),
        "oof_r2": round(float(oof_metrics["r2"]), 4),
        "oof_mse": round(float(oof_metrics["mse"]), 4),
        "oof_mae": round(float(oof_metrics["mae"]), 4),
    }

    with open(os.path.join(HUEKEN_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    # ---------------- predictions.csv (out-of-fold) ----------------
    pred_df = pd.DataFrame(
        {
            "Sample": np.arange(1, n + 1),
            "True": np.round(oof_targets, 6),
            "Predicted": np.round(oof_preds, 6),
        }
    )
    pred_df.to_csv(os.path.join(HUEKEN_DIR, "predictions.csv"), index=False)

    # ---------------- cv_results.csv ----------------
    cv_rows = []
    for r in fold_results:
        cv_rows.append(
            {
                "Fold": r["fold"],
                "Pearson": round(r["pearson"], 4),
                "R2": round(r["r2"], 4),
                "MSE": round(r["mse"], 4),
                "MAE": round(r["mae"], 4),
                "Epochs": r["epochs"],
            }
        )
    cv_rows.append(
        {
            "Fold": "Mean",
            "Pearson": round(float(np.mean(pearson_vals)), 4),
            "R2": round(float(np.mean(r2_vals)), 4),
            "MSE": round(float(np.mean(mse_vals)), 4),
            "MAE": round(float(np.mean(mae_vals)), 4),
            "Epochs": "",
        }
    )
    cv_rows.append(
        {
            "Fold": "SD",
            "Pearson": round(float(np.std(pearson_vals)), 4),
            "R2": round(float(np.std(r2_vals)), 4),
            "MSE": round(float(np.std(mse_vals)), 4),
            "MAE": round(float(np.std(mae_vals)), 4),
            "Epochs": "",
        }
    )
    pd.DataFrame(cv_rows).to_csv(os.path.join(RESULTS_DIR, "cv_results.csv"), index=False)

    # ---------------- learning curve + training log (best fold) ----------------
    plot_learning_curve(best_fold_log, os.path.join(HUEKEN_DIR, "learning_curve.png"), best_fold)
    log_df = pd.DataFrame(best_fold_log)
    log_df.to_csv(os.path.join(HUEKEN_DIR, "training_log.csv"), index=False)

    # ---------------- scatter plot (out-of-fold) ----------------
    plot_scatter(oof_targets, oof_preds, os.path.join(HUEKEN_DIR, "scatter_plot.png"))

    # ---------------- confusion.txt (binary, out-of-fold) ----------------
    cm = confusion_matrix(oof_binary, oof_binary_pred)
    acc = accuracy_score(oof_binary, oof_binary_pred)
    report = classification_report(oof_binary, oof_binary_pred, target_names=["Low efficacy (0)", "High efficacy (1)"])
    with open(os.path.join(HUEKEN_DIR, "confusion.txt"), "w") as f:
        f.write("FusionNet — Binary Classification Confusion (out-of-fold predictions)\n")
        f.write(f"Binary threshold on predicted efficacy: {threshold}\n")
        f.write(f"Test samples: {n}\n")
        f.write(f"Accuracy: {acc:.4f}\n\n")
        f.write("Confusion matrix (rows=true, cols=pred):\n")
        f.write("              Pred Low(0)  Pred High(1)\n")
        f.write(f"True Low(0)   {cm[0,0]:>10}  {cm[0,1]:>10}\n")
        f.write(f"True High(1)  {cm[1,0]:>10}  {cm[1,1]:>10}\n\n")
        f.write("Classification report:\n")
        f.write(report)

    # ---------------- best model ----------------
    torch.save(
        {
            "model_state_dict": best_fold_model_state,
            "input_dim": model_cfg["input_dim"],
            "hidden_dims": model_cfg["hidden_dims"],
            "dropout": model_cfg["dropout"],
            "architecture": "FusionNet",
            "best_fold": best_fold,
            "val_pearson": float(best_fold_pearson),
            "n_epochs": best_fold_n_epochs,
        },
        os.path.join(HUEKEN_DIR, "best_model.pt"),
    )

    torch.save(
        {
            "model_state_dict": best_fold_model_state,
            "input_dim": model_cfg["input_dim"],
            "hidden_dims": model_cfg["hidden_dims"],
            "dropout": model_cfg["dropout"],
            "architecture": "FusionNet",
            "best_fold": best_fold,
            "val_pearson": float(best_fold_pearson),
        },
        os.path.join(MODELS_DIR, "fusion_best.pt"),
    )
    with open(os.path.join(MODELS_DIR, "config.yaml"), "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    # ---------------- hyperparameter_results.csv note ----------------
    # (existing file left in place for supplementary material)

    print(f"\nAll artifacts saved to {HUEKEN_DIR}/")
    print(f"Best model saved to {os.path.join(MODELS_DIR, 'fusion_best.pt')}")
    print(f"metrics.json: {json.dumps(metrics)}")
    print("Done.")


if __name__ == "__main__":
    main()
