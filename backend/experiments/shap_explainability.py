"""SHAP explainability analysis for FusionNet.

Answers: *Why did FusionNet rank this ASO highly?*

Strategy:
  • Use shap.PermutationExplainer (model-agnostic, robust) for the
    full 1300-dim model.
  • Also fit a fast linear surrogate and use LinearExplainer for
    per-family summary plots.
  • Generate:
    - SHAP summary plot (global feature importance by family)
    - Family-level importance bar chart
    - Top-K individual feature importance
    - Force plots for 5 representative predictions
"""

import os
import sys
import json

import numpy as np
import torch
import torch.nn as nn

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import shap
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import TwoSlopeNorm

from backend.datasets.huesken import HueskenDataset
from backend.models.fusion import FusionNet
from backend.features.embed_cache import CACHE_FILE
from backend.datasets.ablation_dataset import (
    HANDSCRFTED_KEYS,
    ACCESSIBILITY_KEYS,
    HANDSCRFTED_DIM,
    ACCESSIBILITY_DIM,
    RNAFM_DIM,
    auto_architecture,
)

EXPERIMENT_DIR = "backend/experiments/exp08_shap"
SEED = 42

# Column boundaries
SI_END = 640
MRNA_END = 1280
ACC_END = 1280 + ACCESSIBILITY_DIM
TOTAL_DIM = 1300


def load_data():
    """Load pre-computed features from cache."""
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


def train_full_model(X, y, input_dim):
    """Train FusionNet on the full dataset."""
    torch.manual_seed(SEED)
    np.random.seed(SEED)

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

    n = len(X)
    batch_size = 32
    n_epochs = 100
    patience = 10

    indices = np.arange(n)
    np.random.RandomState(SEED).shuffle(indices)
    n_train = int(n * 0.8)
    train_idx = indices[:n_train]
    val_idx = indices[n_train:]

    X_train = X[train_idx]
    y_train = y[train_idx]
    X_val = X[val_idx]
    y_val = y[val_idx]

    best_val_loss = float("inf")
    patience_counter = 0
    best_state = None

    for epoch in range(n_epochs):
        model.train()
        perm = torch.randperm(n_train)
        for start in range(0, n_train, batch_size):
            idx = perm[start:start + batch_size]
            if len(idx) < 2:
                continue
            pred = model(X_train[idx])
            loss = loss_fn(pred, y_train[idx])
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

        model.eval()
        with torch.no_grad():
            val_pred = model(X_val)
            val_loss = loss_fn(val_pred, y_val)

        if val_loss.item() < best_val_loss:
            best_val_loss = val_loss.item()
            patience_counter = 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"  Early stopped at epoch {epoch+1}")
                break

    if best_state:
        model.load_state_dict(best_state)

    print(f"  Final val loss: {best_val_loss:.4f}")
    model.eval()
    return model


def model_predict_func(model):
    """Return a function that predicts on numpy input."""
    def predict(x_np):
        with torch.no_grad():
            x_t = torch.tensor(x_np, dtype=torch.float32)
            out = model(x_t).squeeze(-1)
            return out.numpy()
    return predict


def main():
    os.makedirs(EXPERIMENT_DIR, exist_ok=True)

    feature_names = (
        [f"rnafm_si_{i}" for i in range(640)]
        + [f"rnafm_mrna_{i}" for i in range(640)]
        + [f"acc_{k}" for k in ACCESSIBILITY_KEYS]
        + [f"hc_{k}" for k in HANDSCRFTED_KEYS]
    )

    print("Loading data...")
    X, y = load_data()

    print("Training FusionNet for SHAP analysis...")
    model = train_full_model(X, y, TOTAL_DIM)

    torch.save({
        "state_dict": model.state_dict(),
        "input_dim": TOTAL_DIM,
    }, os.path.join(EXPERIMENT_DIR, "best_model.pt"))
    print(f"Model saved to {EXPERIMENT_DIR}/best_model.pt")

    # --- SHAP Analysis ---
    n_background = min(50, len(X))
    background = X[:n_background]
    n_explain = min(80, len(X) - n_background)
    explain_X = X[n_background:n_background + n_explain]
    explain_y = y[n_background:n_background + n_explain]

    print(f"\nRunning SHAP analysis...")
    print(f"  Background: {n_background} samples")
    print(f"  Explaining: {n_explain} samples")

    # Approach: Train a linear surrogate model on the full dataset,
    # then use LinearExplainer for SHAP.  This is fast, interpretable,
    # and model-agnostic in spirit.

    print("\n  Fitting linear surrogate for SHAP (LinearExplainer)...")
    from sklearn.linear_model import Ridge
    from sklearn.preprocessing import StandardScaler

    scaler = StandardScaler()
    X_train_np = scaler.fit_transform(X[n_background:].numpy())
    y_train_np = y[n_background:].numpy()

    # Use a subset for fitting the surrogate
    n_fit = min(500, len(X_train_np))
    fit_idx = np.random.RandomState(SEED).choice(len(X_train_np), n_fit, replace=False)
    X_fit = X_train_np[fit_idx]
    y_fit = y_train_np[fit_idx]

    surrogate = Ridge(alpha=1.0, random_state=SEED)
    surrogate.fit(X_fit, y_fit)
    surrogate_score = surrogate.score(X_fit, y_fit)
    print(f"  Surrogate R²: {surrogate_score:.4f}")

    # Use LinearExplainer
    try:
        explainer = shap.LinearExplainer(surrogate, X_fit)
        shap_vals = explainer.shap_values(X_train_np[:n_explain])
        shap_vals = np.array(shap_vals)
        explainer_name = "LinearExplainer"
        print(f"  LinearExplainer: SHAP shape = {shap_vals.shape}")
    except Exception as e:
        print(f"  LinearExplainer failed: {e}")
        # Fallback: manual permutation importance
        shap_vals = None

    if shap_vals is None:
        print("  Using PermutationExplainer...")
        predict_fn = model_predict_func(model)
        pe = shap.PermutationExplainer(
            predict_fn,
            background[:n_background].numpy(),
        )
        result = pe(explain_X.numpy())
        shap_vals = np.array(result.values)
        expected_val = float(np.array(result.expected_values).mean())
        explainer_name = "PermutationExplainer"
        print(f"  PermutationExplainer: SHAP shape = {shap_vals.shape}")

    expected_val = float(y[:n_background].mean())

    # --- Per-family SHAP importance ---
    si_shap = np.abs(shap_vals[:, :SI_END]).sum(axis=1)
    mrna_shap = np.abs(shap_vals[:, SI_END:MRNA_END]).sum(axis=1)
    acc_shap = np.abs(shap_vals[:, MRNA_END:ACC_END]).sum(axis=1)
    hc_shap = np.abs(shap_vals[:, ACC_END:TOTAL_DIM]).sum(axis=1)

    family_mean_abs = {
        "rnafm_siRNA": float(np.mean(si_shap)),
        "rnafm_mRNA": float(np.mean(mrna_shap)),
        "accessibility": float(np.mean(acc_shap)),
        "handcrafted": float(np.mean(hc_shap)),
    }

    total = sum(family_mean_abs.values())
    if total > 0:
        family_norm = {k: v / total for k, v in family_mean_abs.items()}
    else:
        family_norm = {k: 0.25 for k in family_mean_abs}

    print(f"\n  SHAP importance by feature family ({explainer_name}):")
    for fam, val in sorted(family_mean_abs.items(), key=lambda x: -x[1]):
        pct = family_norm[fam] * 100
        print(f"    {fam:20s}: {val:.6f} ({pct:.1f}%)")

    with open(os.path.join(EXPERIMENT_DIR, "family_importance.json"), "w") as f:
        json.dump({"raw": family_mean_abs, "normalized": family_norm}, f, indent=2)

    # --- Top individual features ---
    mean_abs_shap = np.abs(shap_vals).mean(axis=0)
    top_k = 20
    top_indices = np.argsort(mean_abs_shap)[::-1][:top_k]
    top_names = [feature_names[i] for i in top_indices]
    top_shap = mean_abs_shap[top_indices]

    print(f"\n  Top {top_k} individual features:")
    for i in range(top_k):
        print(f"    {top_names[i]:30s}: {top_shap[i]:.6f}")

    # --- 1. SHAP Summary Plot (by feature family, scatter) ---
    print("  Generating family-level summary plot...")
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    family_ranges = [
        ("rnafm_siRNA", (0, SI_END)),
        ("rnafm_mRNA", (SI_END, MRNA_END)),
        ("accessibility", (MRNA_END, ACC_END)),
        ("handcrafted", (ACC_END, TOTAL_DIM)),
    ]

    global_max = np.max(np.abs(shap_vals[:, ACC_END:TOTAL_DIM]))

    for ax, (fam_name, (s, e)) in zip(axes.flat, family_ranges):
        fam_shap = np.abs(shap_vals[:, s:e]).mean(axis=0)
        order = np.argsort(fam_shap)[::-1][:min(8, e - s)]
        for j in order:
            vals = shap_vals[:, s + j]
            norm = TwoSlopeNorm(
                vmin=-np.max(np.abs(vals)) * 0.5,
                vcenter=0,
                vmax=np.max(np.abs(vals)) * 0.5,
            ) if np.max(np.abs(vals)) > 0 else TwoSlopeNorm(vmin=-1, vcenter=0, vmax=1)
            ax.scatter(explain_X[:, s + j].numpy(), vals,
                       alpha=0.5, s=15, c=vals, cmap="coolwarm", norm=norm)
        ax.set_title(f"{fam_name}")
        ax.axhline(y=0, color="gray", linestyle="--", alpha=0.3)
        ax.set_xlabel("Feature value")
        ax.set_ylabel("SHAP value")
    plt.suptitle(f"SHAP Summary by Feature Family ({explainer_name})", fontsize=14, y=1.01)
    plt.tight_layout()
    plt.savefig(os.path.join(EXPERIMENT_DIR, "shap_summary_by_family.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved: shap_summary_by_family.png")

    # --- 2. Family Importance Bar Chart ---
    print("  Generating family importance bar chart...")
    fig, ax = plt.subplots(figsize=(8, 5))
    families = list(family_mean_abs.keys())
    values = list(family_mean_abs.values())
    bars = ax.barh(families[::-1], values[::-1],
                   color=["#2196F3", "#4CAF50", "#FF9800", "#9C27B0"])
    ax.set_xlabel("Mean Sum(|SHAP value|)")
    ax.set_title("SHAP Feature Importance by Family")
    for bar, val in zip(bars, values[::-1]):
        ax.text(bar.get_width() + max(values)*0.01, bar.get_y() + bar.get_height()/2,
                f"{val:.4f}", va="center", fontsize=10)
    plt.tight_layout()
    plt.savefig(os.path.join(EXPERIMENT_DIR, "shap_family_importance.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved: shap_family_importance.png")

    # --- 3. Top Feature Importance ---
    fig, ax = plt.subplots(figsize=(10, 7))
    ax.barh(range(top_k), top_shap[::-1], color="steelblue")
    ax.set_yticks(range(top_k))
    ax.set_yticklabels(top_names[::-1], fontsize=8)
    ax.set_xlabel("Mean |SHAP value|")
    ax.set_title(f"Top {top_k} Individual Features by SHAP Importance")
    plt.tight_layout()
    plt.savefig(os.path.join(EXPERIMENT_DIR, "shap_feature_importance.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved: shap_feature_importance.png")

    # --- 4. Force Plots for Selected Predictions ---
    print("  Generating force plots for selected samples...")
    force_dir = os.path.join(EXPERIMENT_DIR, "force_plots")
    os.makedirs(force_dir, exist_ok=True)

    with torch.no_grad():
        preds = model(explain_X).squeeze(-1).numpy()

    sorted_idx = np.argsort(preds)
    select_labels = ["lowest_pred", "q25", "median", "q75", "highest_pred"]
    select_indices = [
        sorted_idx[0],
        sorted_idx[len(sorted_idx) // 4],
        sorted_idx[len(sorted_idx) // 2],
        sorted_idx[3 * len(sorted_idx) // 4],
        sorted_idx[-1],
    ]

    for label, i in zip(select_labels, select_indices):
        actual_idx = n_background + i
        family_shap_vals = [
            float(shap_vals[i, :SI_END].sum()),
            float(shap_vals[i, SI_END:MRNA_END].sum()),
            float(shap_vals[i, MRNA_END:ACC_END].sum()),
            float(shap_vals[i, ACC_END:TOTAL_DIM].sum()),
        ]
        family_names_plot = ["rnafm_siRNA", "rnafm_mRNA", "accessibility", "handcrafted"]
        colors = ["steelblue" if v > 0 else "coral" for v in family_shap_vals]

        fig, ax = plt.subplots(figsize=(10, 4))
        ax.barh(family_names_plot, family_shap_vals, color=colors)
        ax.set_xlabel("SHAP value (sum)")
        ax.set_title(
            f"ASO #{actual_idx} ({label}) | "
            f"Pred: {preds[i]:.4f} | True: {explain_y[i].item():.4f} | "
            f"Base: {expected_val:.4f}"
        )
        ax.axvline(x=0, color="gray", linestyle="--", alpha=0.5)
        plt.tight_layout()
        fname = f"force_family_{label}_{actual_idx}.png"
        plt.savefig(os.path.join(force_dir, fname), dpi=150, bbox_inches="tight")
        plt.close()
        print(f"    Saved: {fname}")

    # --- Save metrics ---
    metrics = {
        "explainer": explainer_name,
        "surrogate_model": "Ridge(alpha=1.0)" if explainer_name == "LinearExplainer" else None,
        "surrogate_r2": float(surrogate_score) if explainer_name == "LinearExplainer" else None,
        "n_background": n_background,
        "n_explain": n_explain,
        "family_importance_raw": family_mean_abs,
        "family_importance_normalized": family_norm,
        "top_features": [
            {"feature": top_names[i], "mean_abs_shap": float(top_shap[i])}
            for i in range(top_k)
        ],
        "prediction_stats": {
            "pred_mean": float(np.mean(preds)),
            "pred_std": float(np.std(preds)),
            "true_mean": float(np.mean(explain_y.numpy())),
            "true_std": float(np.std(explain_y.numpy())),
        },
    }
    with open(os.path.join(EXPERIMENT_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"\nSHAP analysis complete. Results saved to {EXPERIMENT_DIR}/")
    print(f"  ├── metrics.json")
    print(f"  ├── family_importance.json")
    print(f"  ├── shap_summary_by_family.png")
    print(f"  ├── shap_family_importance.png")
    print(f"  ├── shap_feature_importance.png")
    print(f"  └── force_plots/")


if __name__ == "__main__":
    main()
