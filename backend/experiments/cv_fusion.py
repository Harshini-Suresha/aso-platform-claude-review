import os

import numpy as np
import torch
from sklearn.model_selection import KFold
from torch.utils.data import DataLoader

from backend.config import load_config
from backend.datasets.huesken import HueskenDataset
from backend.datasets.torch_dataset import ASOFusedDataset
from backend.features.embed_cache import CACHE_FILE
from backend.models.fusion import FusionNet

CONFIG_PATH = "backend/config/config.yaml"
N_FOLDS = 5


def train_one_fold(train_loader, val_loader, model_cfg, train_cfg, checkpoint_dir, fold_idx):
    print(f"  [Fold {fold_idx}] Model initialized: FusionNet(input_dim={model_cfg['input_dim']}, hidden_dims={model_cfg['hidden_dims']})")
    model = FusionNet(
        input_dim=model_cfg["input_dim"],
        hidden_dims=model_cfg["hidden_dims"],
        dropout=model_cfg["dropout"],
    )
    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=train_cfg["learning_rate"],
    )
    print(f"  [Fold {fold_idx}] Optimizer initialized: Adam(lr={train_cfg['learning_rate']})")
    loss_fn = torch.nn.MSELoss()

    epochs = train_cfg["epochs"]
    patience = train_cfg.get("patience", 10)
    best_val_loss = float("inf")
    patience_counter = 0
    best_model_state = None

    for epoch in range(epochs):
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

        avg_train_loss = epoch_loss / max(n_batches, 1)
        avg_val_loss = val_loss / max(n_val_batches, 1)

        train_preds = np.concatenate(all_train_preds).flatten()
        train_targets = np.concatenate(all_train_targets).flatten()
        val_preds = np.concatenate(all_val_preds).flatten()
        val_targets = np.concatenate(all_val_targets).flatten()

        train_pearson = pearson_corr(train_preds, train_targets)
        val_pearson = pearson_corr(val_preds, val_targets)

        print(
            f"  Epoch {epoch+1:3d}/{epochs} | "
            f"train MSE: {avg_train_loss:.4f} | "
            f"val MSE: {avg_val_loss:.4f} | "
            f"val Pearson: {val_pearson:.4f}"
        )

        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            patience_counter = 0
            best_model_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(
                    f"  Early stopping at epoch {epoch+1} "
                    f"(best val MSE: {best_val_loss:.4f})"
                )
                break

    if best_model_state is not None:
        model.load_state_dict(best_model_state)

    ckpt_path = os.path.join(
        checkpoint_dir, f"fusion_fold{fold_idx}.pth"
    )
    torch.save(model.state_dict(), ckpt_path)
    print(f"  Checkpoint saved to {ckpt_path}")

    return model


def pearson_corr(preds, targets):
    if preds.std() == 0 or targets.std() == 0:
        return 0.0
    return np.corrcoef(preds, targets)[0, 1]


def evaluate(model, dataloader):
    model.eval()
    all_preds = []
    all_targets = []

    with torch.no_grad():
        for X, y in dataloader:
            pred = model(X)
            all_preds.append(pred.numpy())
            all_targets.append(y.numpy())

    preds = np.concatenate(all_preds)
    targets = np.concatenate(all_targets)

    mse = np.mean((preds - targets) ** 2)
    mae = np.mean(np.abs(preds - targets))

    if preds.std() == 0:
        pearson = 0.0
    else:
        pearson = np.corrcoef(preds, targets)[0, 1]

    ss_res = np.sum((targets - preds) ** 2)
    ss_tot = np.sum((targets - targets.mean()) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return {
        "MSE": float(mse),
        "MAE": float(mae),
        "Pearson": float(pearson),
        "R2": float(r2),
    }


def main():
    config = load_config(CONFIG_PATH)

    data_cfg = config["data"]
    model_cfg = config["model"]
    train_cfg = config["train"]
    paths = config["paths"]

    torch.manual_seed(data_cfg["seed"])

    full_dataset = HueskenDataset(data_cfg["csv_path"])

    cache_path = CACHE_FILE
    if os.path.exists(cache_path):
        print(f"Loading precomputed embeddings from {cache_path}")
        aso_dataset = ASOFusedDataset(
            full_dataset, cache_path=cache_path
        )
    else:
        print("No embedding cache found.")
        return

    n = len(aso_dataset)
    indices = np.arange(n)

    kf = KFold(n_splits=N_FOLDS, shuffle=True, random_state=data_cfg["seed"])

    results = []

    for fold_idx, (train_idx, val_idx) in enumerate(kf.split(indices)):
        print(f"\n{'='*50}")
        print(f"Fold {fold_idx + 1}/{N_FOLDS} - Training...")
        print(f"{'='*50}")

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

        model = train_one_fold(
            train_loader, val_loader, model_cfg, train_cfg,
            paths["checkpoint_dir"], fold_idx,
        )
        fold_results = evaluate(model, val_loader)
        results.append(fold_results)

        print(
            f"  Pearson: {fold_results['Pearson']:.4f}  "
            f"R²: {fold_results['R2']:.4f}  "
            f"MSE: {fold_results['MSE']:.4f}"
        )

    pearson_vals = [r["Pearson"] for r in results]
    r2_vals = [r["R2"] for r in results]

    print(f"\n{'='*50}")
    print(f"5-Fold Cross-Validation Results")
    print(f"{'='*50}")
    print(f"{'Fold':<6} {'Pearson':>10} {'R²':>10}")
    print(f"{'-'*6} {'-'*10} {'-'*10}")
    for i, r in enumerate(results):
        print(f"{i+1:<6} {r['Pearson']:>10.4f} {r['R2']:>10.4f}")
    print(f"{'-'*6} {'-'*10} {'-'*10}")
    print(
        f"Mean  {np.mean(pearson_vals):>10.4f} "
        f"{np.mean(r2_vals):>10.4f}"
    )
    print(
        f"SD    {np.std(pearson_vals):>10.4f} "
        f"{np.std(r2_vals):>10.4f}"
    )

    results_path = os.path.join(
        os.path.dirname(__file__), "cv_results.txt"
    )
    with open(results_path, "w") as f:
        f.write("Fold\tPearson\tR²\n")
        for i, r in enumerate(results):
            f.write(f"{i+1}\t{r['Pearson']:.4f}\t{r['R2']:.4f}\n")
        f.write(f"Mean\t{np.mean(pearson_vals):.4f}\t{np.mean(r2_vals):.4f}\n")
        f.write(f"SD\t{np.std(pearson_vals):.4f}\t{np.std(r2_vals):.4f}\n")
    print(f"\nResults saved to {results_path}")


if __name__ == "__main__":
    main()