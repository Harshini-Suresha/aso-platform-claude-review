import os
import torch

from backend.datasets.huesken import HueskenDataset
from backend.features.rnafm import RNAFMEmbedder
from backend.features.accessibility import AccessibilityFeatures

CACHE_DIR = "backend/data"
CACHE_FILE = os.path.join(CACHE_DIR, "hu_embeddings.pt")

ACCESSIBILITY_KEYS = [
    "accessibility_mean",
    "accessibility_min",
    "accessibility_max",
    "accessibility_global_mean",
    "accessibility_global_min",
    "accessibility_global_max",
    "sliding_window_mean",
    "positional_entropy_mean",
    "positional_entropy_global_mean",
    "binding_site_start",
    "binding_site_end",
]


def precompute_embeddings(
    csv_path: str = "OligoFormer/data/Hu.csv",
    model_path: str = "backend/pretrained/RNA-FM_pretrained.pth",
    cache_path: str = CACHE_FILE,
    batch_size: int = 64,
) -> str:
    """Precompute RNA-FM embeddings and accessibility features for all
    siRNA and mRNA sequences in the Huesken dataset.

    Caches results to disk as a .pt file containing:
      - embeddings:    (N, 1280)  — siRNA(640) + mRNA(640)
      - accessibility: (N, 11)    — RNAplfold-style features
      - labels:        (N,)       — continuous efficacy

    Returns the path to the cache file.
    """
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)

    dataset = HueskenDataset(csv_path)
    embedder = RNAFMEmbedder(model_path)

    n = len(dataset)
    embeddings = torch.zeros(n, 2 * embedder.embedding_dim)
    accessibility = torch.zeros(n, len(ACCESSIBILITY_KEYS))
    labels = torch.zeros(n)

    si_rna_seqs = [dataset[i]["aso_sequence"] for i in range(n)]
    mrna_seqs = [dataset[i]["mrna_sequence"] for i in range(n)]
    effs = [dataset[i]["efficacy"] for i in range(n)]

    for start in range(0, n, batch_size):
        end = min(start + batch_size, n)

        si_emb = embedder.embed_batch(si_rna_seqs[start:end])
        mr_emb = embedder.embed_batch(mrna_seqs[start:end])

        embeddings[start:end] = torch.cat([si_emb, mr_emb], dim=1)
        labels[start:end] = torch.tensor(effs[start:end], dtype=torch.float32)

        print(f"Processed {end}/{n} sequences", end="\r")

    print()
    print("Computing accessibility features...")

    for i in range(n):
        acc = AccessibilityFeatures.compute(mrna_seqs[i], si_rna_seqs[i])
        accessibility[i] = torch.tensor(
            [acc[k] for k in ACCESSIBILITY_KEYS], dtype=torch.float32
        )

        if (i + 1) % 100 == 0:
            print(f"Accessibility: {i + 1}/{n}", end="\r")

    print()

    torch.save(
        {
            "embeddings": embeddings,
            "accessibility": accessibility,
            "labels": labels,
        },
        cache_path,
    )

    total_dim = embeddings.shape[1] + accessibility.shape[1]
    print(
        f"Cache saved to {cache_path}  "
        f"(embeddings: {embeddings.shape}, "
        f"accessibility: {accessibility.shape}, "
        f"combined: {total_dim}-dim)"
    )

    return cache_path


def load_embeddings(cache_path: str = CACHE_FILE):
    """Load precomputed embeddings and accessibility from cache."""
    if not os.path.exists(cache_path):
        raise FileNotFoundError(
            f"No embedding cache found at {cache_path}. "
            f"Run precompute_embeddings() first."
        )
    data = torch.load(cache_path, weights_only=True)
    return (
        data["embeddings"],
        data["accessibility"],
        data["labels"],
    )


if __name__ == "__main__":
    precompute_embeddings()
