import os

import torch
from torch.utils.data import DataLoader
from torch.utils.data import random_split

from backend.config import load_config
from backend.datasets.huesken import HueskenDataset
from backend.datasets.torch_dataset import ASOEmbeddingDataset
from backend.models.baseline import BaselineMLP
from backend.features.embed_cache import CACHE_FILE

CONFIG_PATH = "backend/config/config.yaml"


def main():
    config = load_config(CONFIG_PATH)

    data_cfg = config["data"]
    model_cfg = config["model"]
    train_cfg = config["train"]
    paths = config["paths"]

    torch.manual_seed(data_cfg["seed"])

    os.makedirs(paths["checkpoint_dir"], exist_ok=True)
    os.makedirs(paths["log_dir"], exist_ok=True)

    full_dataset = HueskenDataset(data_cfg["csv_path"])

    cache_path = CACHE_FILE
    if os.path.exists(cache_path):
        print(f"Loading precomputed embeddings from {cache_path}")
        aso_dataset = ASOEmbeddingDataset(
            full_dataset, cache_path=cache_path
        )
    else:
        print("No embedding cache found — computing on-the-fly (slow)")
        aso_dataset = ASOEmbeddingDataset(full_dataset)

    n = len(aso_dataset)
    n_train = int(n * data_cfg["train_split"])
    n_val = n - n_train

    generator = torch.Generator().manual_seed(data_cfg["seed"])
    train_dataset, val_dataset = random_split(
        aso_dataset, [n_train, n_val], generator=generator
    )

    train_loader = DataLoader(
        train_dataset,
        batch_size=train_cfg["batch_size"],
        shuffle=True,
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

    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=train_cfg["learning_rate"],
    )
    loss_fn = torch.nn.MSELoss()

    print(f"\nTraining config:")
    print(f"  Dataset size: {n} (train={n_train}, val={n_val})")
    print(f"  Batch size:   {train_cfg['batch_size']}")
    print(f"  Epochs:       {train_cfg['epochs']}")
    print(f"  LR:           {train_cfg['learning_rate']}")
    print(f"  Input dim:    {model_cfg['input_dim']}")
    print()

    for epoch in range(train_cfg["epochs"]):
        model.train()
        epoch_loss = 0.0
        n_batches = 0

        for X, y in train_loader:
            pred = model(X)
            loss = loss_fn(pred, y)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()
            n_batches += 1

        avg_train_loss = epoch_loss / max(n_batches, 1)

        model.eval()
        val_loss = 0.0
        n_val_batches = 0

        with torch.no_grad():
            for X, y in val_loader:
                pred = model(X)
                loss = loss_fn(pred, y)
                val_loss += loss.item()
                n_val_batches += 1

        avg_val_loss = val_loss / max(n_val_batches, 1)

        print(
            f"Epoch {epoch:3d} | "
            f"train MSE: {avg_train_loss:.4f} | "
            f"val MSE: {avg_val_loss:.4f}"
        )

    ckpt_path = os.path.join(
        paths["checkpoint_dir"], paths["checkpoint_name"] + ".pth"
    )
    torch.save(model.state_dict(), ckpt_path)
    print(f"\nModel saved to {ckpt_path}")


if __name__ == "__main__":
    main()
