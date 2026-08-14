import os

import numpy as np
import torch
from torch.utils.data import DataLoader
from torch.utils.data import random_split

from backend.config import load_config
from backend.datasets.huesken import HueskenDataset
from backend.datasets.torch_dataset import ASOEmbeddingDataset
from backend.models.baseline import BaselineMLP
from backend.features.embed_cache import CACHE_FILE

CONFIG_PATH = "backend/config/config.yaml"


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
        aso_dataset = ASOEmbeddingDataset(
            full_dataset, cache_path=cache_path
        )
    else:
        print("No embedding cache found.")
        return

    n = len(aso_dataset)
    n_train = int(n * data_cfg["train_split"])
    n_val = n - n_train

    generator = torch.Generator().manual_seed(data_cfg["seed"])
    _, val_dataset = random_split(
        aso_dataset, [n_train, n_val], generator=generator
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=train_cfg["batch_size"],
        shuffle=False,
    )

    model = BaselineMLP(
        input_dim=model_cfg["input_dim"],
        hidden_dim=model_cfg["hidden_dim"],
    )

    ckpt_path = os.path.join(
        paths["checkpoint_dir"], paths["checkpoint_name"] + ".pth"
    )
    model.load_state_dict(torch.load(ckpt_path, weights_only=True))

    results = evaluate(model, val_loader)

    print(f"\n=== RNA-FM Baseline Evaluation ===")
    print(f"Validation samples: {n_val}")
    print(f"Input dim:          {model_cfg['input_dim']}")
    print()
    for metric, value in results.items():
        print(f"  {metric:12s}: {value:.4f}")


if __name__ == "__main__":
    main()
