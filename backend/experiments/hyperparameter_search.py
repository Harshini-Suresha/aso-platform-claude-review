import argparse
import csv
import itertools
import os
import random
import time

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import numpy as np
import torch
from sklearn.model_selection import KFold

from backend.config import load_config
from backend.datasets.huesken import HueskenDataset
from backend.datasets.torch_dataset import ASOFusedDataset
from backend.features.embed_cache import CACHE_FILE
from backend.models.fusion import FusionNet

torch.set_num_threads(max(os.cpu_count() or 1, 1))

CONFIG_PATH = "backend/config/config.yaml"
N_FOLDS_DEFAULT = 3
RESULTS_DIR = "backend/results"

SEARCH_SPACE = {
    "learning_rate": [1e-3, 5e-4, 1e-4],
    "dropout": [0.2, 0.3, 0.4],
    "hidden_dims": [
        [256, 128, 64],
        [512, 256, 128, 64],
        [768, 512, 256],
    ],
    "weight_decay": [0, 1e-5, 1e-4],
    "batch_size": [16, 32, 64],
}

CSV_HEADER = [
    "Run", "LR", "Dropout", "Hidden", "WD", "Batch",
    "Pearson_Mean", "Pearson_SD", "R2_Mean", "R2_SD", "Time_s",
]


def load_all_data(dataset):
    """Pre-load entire dataset into tensors (avoids per-sample Python overhead)."""
    n = len(dataset)
    sample_x, _ = dataset[0]
    input_dim = sample_x.shape[0]
    X = torch.zeros(n, input_dim, dtype=torch.float32)
    y = torch.zeros(n, dtype=torch.float32)
    for i in range(n):
        x_i, y_i = dataset[i]
        X[i] = x_i
        y[i] = y_i
    return X, y, input_dim


def train_one_fold(X_train, y_train, X_val, y_val, config, n_epochs, patience):
    model = FusionNet(
        input_dim=X_train.shape[1],
        hidden_dims=config["hidden_dims"],
        dropout=config["dropout"],
    )
    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=config["learning_rate"],
        weight_decay=config["weight_decay"],
    )
    loss_fn = torch.nn.MSELoss()

    batch_size = config["batch_size"]
    n_train = len(X_train)
    best_val_loss = float("inf")
    patience_counter = 0
    best_model_state = None

    for epoch in range(n_epochs):
        model.train()
        perm = torch.randperm(n_train)
        for start in range(0, n_train, batch_size):
            idx = perm[start:start + batch_size]
            if len(idx) < 2:
                continue
            X_batch = X_train[idx]
            y_batch = y_train[idx]
            pred = model(X_batch)
            loss = loss_fn(pred, y_batch)
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
            best_model_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            patience_counter += 1
            if patience_counter >= patience:
                break

    if best_model_state is not None:
        model.load_state_dict(best_model_state)

    return model


def evaluate(model, X, y):
    model.eval()
    with torch.no_grad():
        preds = model(X).squeeze(-1)

    preds_np = preds.numpy()
    targets_np = y.numpy()

    mse = np.mean((preds_np - targets_np) ** 2)
    ss_tot = np.sum((targets_np - targets_np.mean()) ** 2)
    r2 = 1 - np.sum((targets_np - preds_np) ** 2) / ss_tot if ss_tot > 0 else 0.0

    if preds_np.std() == 0 or targets_np.std() == 0:
        pearson = 0.0
    else:
        pearson = np.corrcoef(preds_np, targets_np)[0, 1]

    return {
        "pearson": float(pearson),
        "r2": float(r2),
    }


def run_config(config, X, y, n_folds, n_epochs, patience, seed):
    indices = np.arange(len(X))
    kf = KFold(n_splits=n_folds, shuffle=True, random_state=seed)

    fold_pearsons = []
    fold_r2s = []

    for fold_idx, (train_idx, val_idx) in enumerate(kf.split(indices)):
        X_train = X[train_idx]
        y_train = y[train_idx]
        X_val = X[val_idx]
        y_val = y[val_idx]

        model = train_one_fold(
            X_train, y_train, X_val, y_val, config,
            n_epochs, patience,
        )

        metrics = evaluate(model, X_val, y_val)
        fold_pearsons.append(metrics["pearson"])
        fold_r2s.append(metrics["r2"])

    return {
        "pearson_mean": float(np.mean(fold_pearsons)),
        "pearson_sd": float(np.std(fold_pearsons)),
        "r2_mean": float(np.mean(fold_r2s)),
        "r2_sd": float(np.std(fold_r2s)),
    }


def generate_configs(search_space):
    keys = list(search_space.keys())
    values = [search_space[k] for k in keys]
    configs = []
    for combo in itertools.product(*values):
        config = dict(zip(keys, combo))
        configs.append(config)
    return configs


def append_csv(csv_path, row):
    file_exists = os.path.exists(csv_path) and os.path.getsize(csv_path) > 0
    with open(csv_path, "a", newline="") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(CSV_HEADER)
        writer.writerow(row)


def load_completed_runs(csv_path):
    completed = set()
    if not os.path.exists(csv_path):
        return completed
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            completed.add(int(row["Run"]))
    return completed


def load_best_config(csv_path):
    """Find the config with the highest Pearson from the results CSV."""
    if not os.path.exists(csv_path):
        return None, None
    best_pearson = -1
    best_row = None
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pearson = float(row["Pearson_Mean"])
            if pearson > best_pearson:
                best_pearson = pearson
                best_row = row
    if best_row is None:
        return None, None
    config = {
        "learning_rate": float(best_row["LR"]),
        "dropout": float(best_row["Dropout"]),
        "hidden_dims": eval(best_row["Hidden"]),
        "weight_decay": float(best_row["WD"]),
        "batch_size": int(best_row["Batch"]),
    }
    return config, best_pearson


def format_eta(seconds):
    if seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        return f"{seconds/60:.1f}m"
    else:
        return f"{seconds/3600:.1f}h"


def main():
    parser = argparse.ArgumentParser(description="Hyperparameter grid search for FusionNet")
    parser.add_argument("--max-trials", type=int, default=None,
                        help="Max configs to try (default: all 243)")
    parser.add_argument("--full-cv", action="store_true",
                        help="Use 5-fold CV instead of 3-fold during search")
    parser.add_argument("--best-only", action="store_true",
                        help="Run 5-fold CV on the best config from CSV (requires --full-cv)")
    parser.add_argument("--epochs", type=int, default=30,
                        help="Max epochs per fold (default: 30, use 100 for full training)")
    parser.add_argument("--patience", type=int, default=10,
                        help="Early stopping patience (default: 10)")
    parser.add_argument("--resume", action="store_true",
                        help="Skip configs already in CSV")
    parser.add_argument("--output-dir", type=str, default=RESULTS_DIR)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    n_folds = 5 if args.full_cv else N_FOLDS_DEFAULT

    config = load_config(CONFIG_PATH)
    data_cfg = config["data"]
    model_cfg = config["model"]

    torch.manual_seed(data_cfg["seed"])

    full_dataset = HueskenDataset(data_cfg["csv_path"])

    cache_path = CACHE_FILE
    if not os.path.exists(cache_path):
        print("No embedding cache found. Run embed_cache.py first.")
        return

    print(f"Loading precomputed embeddings from {cache_path}")
    aso_dataset = ASOFusedDataset(full_dataset, cache_path=cache_path)
    n_samples = len(aso_dataset)

    print("Pre-loading all data into tensors...")
    X, y, input_dim = load_all_data(aso_dataset)
    print(f"Dataset: {n_samples} samples, input_dim={input_dim}")

    all_configs = generate_configs(SEARCH_SPACE)
    total_configs = len(all_configs)

    csv_path = os.path.join(args.output_dir, "hyperparameter_results.csv")

    if args.best_only:
        best_config, best_pearson = load_best_config(csv_path)
        if best_config is None:
            print(f"No results found in {csv_path}. Run grid search first.")
            return
        print(f"Best config from CSV: Pearson={best_pearson:.4f}")
        print(f"  lr={best_config['learning_rate']}, dropout={best_config['dropout']}, "
              f"hidden={best_config['hidden_dims']}, wd={best_config['weight_decay']}, "
              f"batch={best_config['batch_size']}")
        configs_to_run = [(0, best_config)]
        total_configs = 1
        completed_runs = set()
    else:
        if args.max_trials and args.max_trials < total_configs:
            random.seed(args.seed)
            all_configs = random.sample(all_configs, args.max_trials)

        completed_runs = set()
        if args.resume:
            completed_runs = load_completed_runs(csv_path)
            if completed_runs:
                print(f"Resuming: skipping {len(completed_runs)} completed runs")

        configs_to_run = []
        for i, cfg in enumerate(all_configs, 1):
            if i not in completed_runs:
                configs_to_run.append((i, cfg))

    os.makedirs(args.output_dir, exist_ok=True)

    print(f"Search space: {total_configs} total configs")
    print(f"Running: {len(configs_to_run)} configs x {n_folds}-fold CV")
    print(f"Epochs/fold: {args.epochs}, Patience: {args.patience}")
    print(f"Threads: {torch.get_num_threads()}")
    print(f"Output: {csv_path}")

    best_pearson = -1
    best_config = None
    start_time = time.time()

    for run_id, config in configs_to_run:
        config_label = (
            f"lr={config['learning_rate']}, dropout={config['dropout']}, "
            f"hidden={config['hidden_dims']}, wd={config['weight_decay']}, "
            f"batch={config['batch_size']}"
        )
        print(f"\n[{run_id}/{total_configs}] {config_label}")

        run_start = time.time()
        results = run_config(
            config, X, y, n_folds,
            args.epochs, args.patience,
            args.seed,
        )
        elapsed = time.time() - run_start

        if not args.best_only:
            row = [
                run_id,
                config["learning_rate"],
                config["dropout"],
                str(config["hidden_dims"]),
                config["weight_decay"],
                config["batch_size"],
                f"{results['pearson_mean']:.4f}",
                f"{results['pearson_sd']:.4f}",
                f"{results['r2_mean']:.4f}",
                f"{results['r2_sd']:.4f}",
                f"{elapsed:.1f}",
            ]
            append_csv(csv_path, row)

        completed_count = len(completed_runs) + sum(1 for rid, _ in configs_to_run if rid <= run_id)
        elapsed_total = time.time() - start_time
        if elapsed > 0:
            avg_per_config = elapsed_total / completed_count
            remaining = (total_configs - run_id) * avg_per_config
            eta = format_eta(remaining)
        else:
            eta = "?"

        print(
            f"  Pearson: {results['pearson_mean']:.4f} +/- {results['pearson_sd']:.4f}  "
            f"R2: {results['r2_mean']:.4f}  ({elapsed:.1f}s, ETA: {eta})"
        )

        if results["pearson_mean"] > best_pearson:
            best_pearson = results["pearson_mean"]
            best_config = config
            print(f"  *** NEW BEST ***")

    total_time = time.time() - start_time

    print(f"\n{'='*60}")
    print(f"SEARCH COMPLETE — {len(configs_to_run)} configs in {format_eta(total_time)}")
    print(f"{'='*60}")
    print(f"\nBest Pearson: {best_pearson:.4f}")
    print(f"Best config:")
    for k, v in best_config.items():
        print(f"  {k}: {v}")

    print(f"\nResults saved to: {csv_path}")


if __name__ == "__main__":
    main()
