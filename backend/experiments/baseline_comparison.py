"""Baseline comparison: compare FusionNet against classical ML models
using the same features (full 1300-dim input).

Models compared:
  • Random Forest Regressor
  • XGBoost Regressor
  • Support Vector Regression (RBF kernel)
  • FusionNet (MLP) — for reference

Each model is evaluated with the same 5-fold CV protocol.
"""

import os
import sys
import json
import numpy as np
import torch
import yaml

from sklearn.model_selection import KFold
from sklearn.ensemble import RandomForestRegressor
from sklearn.svm import SVR
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.pipeline import Pipeline

import xgboost as xgb

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.datasets.huesken import HueskenDataset
from backend.datasets.ablation_dataset import AblationDataset
from backend.models.fusion import FusionNet
from backend.features.embed_cache import CACHE_FILE
from backend.datasets.ablation_dataset import auto_architecture

N_FOLDS = 5
SEED = 42
EPOCHS = 100
PATIENCE = 10

EXPERIMENT_BASE_DIR = "backend/experiments"


def pearson_corr(preds, targets):
    if preds.std() == 0 or targets.std() == 0:
        return 0.0
    return np.corrcoef(preds, targets)[0, 1]


def evaluate_preds(preds, targets):
    mse = mean_squared_error(targets, preds)
    mae = mean_absolute_error(targets, preds)
    r2 = r2_score(targets, preds)
    pearson = pearson_corr(preds, targets)
    return {
        "pearson": float(pearson),
        "r2": float(r2),
        "mse": float(mse),
        "mae": float(mae),
    }


def load_all_data():
    """Load full feature tensors from cache (no per-sample ViennaRNA calls)."""
    data = torch.load(CACHE_FILE, weights_only=True)
    embeddings = data["embeddings"]      # (N, 1280)
    accessibility = data["accessibility"]  # (N, 11)
    labels = data["labels"]              # (N,)

    # Pre-compute handcrafted features
    base = HueskenDataset("OligoFormer/data/Hu.csv")
    from backend.datasets.ablation_dataset import HANDSCRFTED_KEYS
    n = len(base)
    handcrafted = torch.zeros(n, len(HANDSCRFTED_KEYS), dtype=torch.float32)
    for i in range(n):
        feats = base[i]["features"]
        handcrafted[i] = torch.tensor(
            [feats[k] for k in HANDSCRFTED_KEYS], dtype=torch.float32
        )

    # Full feature vector: [rnafm(1280), acc(11), hc(9)] = 1300
    X = torch.cat([embeddings, accessibility, handcrafted], dim=1)
    return X.numpy(), labels.numpy(), X.shape[1]


def train_fusionnet_fold(X_train, y_train, X_val, y_val, input_dim, seed):
    torch.manual_seed(seed)
    np.random.seed(seed)

    hidden_dims = auto_architecture(input_dim)

    model = FusionNet(
        input_dim=input_dim,
        hidden_dims=hidden_dims,
        dropout=0.2,
    )
    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=1e-3,
        weight_decay=1e-5,
    )
    loss_fn = torch.nn.MSELoss()

    X_train_t = torch.tensor(X_train, dtype=torch.float32)
    y_train_t = torch.tensor(y_train, dtype=torch.float32)
    X_val_t = torch.tensor(X_val, dtype=torch.float32)
    y_val_t = torch.tensor(y_val, dtype=torch.float32)

    batch_size = 32
    n_train = len(X_train_t)
    best_val_loss = float("inf")
    patience_counter = 0
    best_model_state = None

    for epoch in range(EPOCHS):
        model.train()
        perm = torch.randperm(n_train)
        for start in range(0, n_train, batch_size):
            idx = perm[start:start + batch_size]
            if len(idx) < 2:
                continue
            pred = model(X_train_t[idx])
            loss = loss_fn(pred, y_train_t[idx])
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

        model.eval()
        with torch.no_grad():
            val_pred = model(X_val_t)
            val_loss = loss_fn(val_pred, y_val_t)

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

    with torch.no_grad():
        preds = model(X_val_t).squeeze(-1).numpy()

    return preds


def run_baselines():
    print("Loading data from cache...")
    X, y, input_dim = load_all_data()
    print(f"  Input dim: {input_dim}, Samples: {len(X)}")

    # Define classical ML models (tuned for speed with 1300-dim features)
    models = {
        "RandomForest": Pipeline([
            ("scaler", StandardScaler()),
            ("rf", RandomForestRegressor(
                n_estimators=200,
                max_depth=15,
                min_samples_split=10,
                min_samples_leaf=5,
                max_features="sqrt",
                random_state=SEED,
                n_jobs=-1,
            )),
        ]),
        "XGBoost": Pipeline([
            ("scaler", StandardScaler()),
            ("xgb", xgb.XGBRegressor(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.1,
                subsample=0.8,
                colsample_bytree=0.8,
                reg_alpha=0.1,
                reg_lambda=1.0,
                random_state=SEED,
                n_jobs=-1,
            )),
        ]),
        "SVR_rbf": Pipeline([
            ("scaler", StandardScaler()),
            ("svr", SVR(kernel="rbf", C=10.0, gamma="scale", cache_size=500)),
        ]),
    }

    indices = np.arange(len(X))
    kf = KFold(n_splits=N_FOLDS, shuffle=True, random_state=SEED)

    all_results = {}

    for model_name, model in models.items():
        print(f"\n--- {model_name} ---")
        fold_metrics = []

        for fold_idx, (train_idx, val_idx) in enumerate(kf.split(indices)):
            X_train = X[train_idx]
            y_train = y[train_idx]
            X_val = X[val_idx]
            y_val = y[val_idx]

            model.fit(X_train, y_train)
            preds = model.predict(X_val)

            metrics = evaluate_preds(preds, y_val)
            fold_metrics.append(metrics)
            print(f"  Fold {fold_idx + 1}: Pearson={metrics['pearson']:.4f}  R²={metrics['r2']:.4f}")

        pearsons = [r["pearson"] for r in fold_metrics]
        r2s = [r["r2"] for r in fold_metrics]
        mses = [r["mse"] for r in fold_metrics]
        maes = [r["mae"] for r in fold_metrics]

        all_results[model_name] = {
            "experiment": model_name,
            "feature_families": ["rnafm", "accessibility", "handcrafted"],
            "input_dim": input_dim,
            "folds": [
                {"fold": i + 1, **fold_metrics[i]}
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

    # FusionNet for reference
    print(f"\n--- FusionNet ---")
    fold_metrics_fn = []

    for fold_idx, (train_idx, val_idx) in enumerate(kf.split(indices)):
        X_train = X[train_idx]
        y_train = y[train_idx]
        X_val = X[val_idx]
        y_val = y[val_idx]

        preds = train_fusionnet_fold(
            X_train, y_train, X_val, y_val, input_dim, seed=SEED + fold_idx
        )
        metrics = evaluate_preds(preds, y_val)
        fold_metrics_fn.append(metrics)
        print(f"  Fold {fold_idx + 1}: Pearson={metrics['pearson']:.4f}  R²={metrics['r2']:.4f}")

    pearsons = [r["pearson"] for r in fold_metrics_fn]
    r2s = [r["r2"] for r in fold_metrics_fn]
    mses = [r["mse"] for r in fold_metrics_fn]
    maes = [r["mae"] for r in fold_metrics_fn]

    all_results["FusionNet"] = {
        "experiment": "FusionNet",
        "feature_families": ["rnafm", "accessibility", "handcrafted"],
        "input_dim": input_dim,
        "folds": [
            {"fold": i + 1, **fold_metrics_fn[i]}
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

    # Summary table
    print(f"\n{'='*70}")
    print(f"BASELINE COMPARISON — 5-Fold CV (Full {input_dim}-dim features)")
    print(f"{'='*70}")
    print(f"{'Model':<20} {'Pearson':>14} {'R²':>14} {'MSE':>10} {'MAE':>10}")
    print(f"{'-'*20} {'-'*14} {'-'*14} {'-'*10} {'-'*10}")
    for name, r in all_results.items():
        print(f"{name:<20} "
              f"{r['pearson_mean']:>7.4f} ± {r['pearson_sd']:<4.4f}  "
              f"{r['r2_mean']:>7.4f} ± {r['r2_sd']:<4.4f}  "
              f"{r['mse_mean']:>7.4f}  "
              f"{r['mae_mean']:>7.4f}")
    print()

    # Save results
    exp_dir = os.path.join(EXPERIMENT_BASE_DIR, "exp07_baselines")
    os.makedirs(exp_dir, exist_ok=True)

    config_out = {
        "experiment": "baseline_comparison",
        "description": "Classical ML baselines vs FusionNet",
        "input_dim": input_dim,
        "n_folds": N_FOLDS,
        "seed": SEED,
        "models": {
            "RandomForest": {"n_estimators": 200, "max_depth": 15, "max_features": "sqrt"},
            "XGBoost": {"n_estimators": 200, "max_depth": 6, "learning_rate": 0.1},
            "SVR_rbf": {"C": 10.0, "gamma": "scale"},
            "FusionNet": {"hidden_dims": auto_architecture(input_dim), "dropout": 0.2},
        },
    }
    with open(os.path.join(exp_dir, "config.yaml"), "w") as f:
        yaml.dump(config_out, f, default_flow_style=False, sort_keys=False)

    with open(os.path.join(exp_dir, "metrics.json"), "w") as f:
        json.dump(all_results, f, indent=2)

    md = "| Model | Pearson | R² | MSE | MAE |\n"
    md += "|-------|---------|-----|-----|-----|\n"
    for name, r in all_results.items():
        md += (f"| {name} | {r['pearson_mean']:.4f} ± {r['pearson_sd']:.4f} "
               f"| {r['r2_mean']:.4f} ± {r['r2_sd']:.4f} "
               f"| {r['mse_mean']:.4f} | {r['mae_mean']:.4f} |\n")

    with open(os.path.join(exp_dir, "baseline_table.md"), "w") as f:
        f.write(md)

    print(f"Results saved to {exp_dir}/")
    print(f"  - config.yaml")
    print(f"  - metrics.json")
    print(f"  - baseline_table.md")


if __name__ == "__main__":
    run_baselines()
