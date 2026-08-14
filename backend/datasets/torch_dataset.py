import os

import torch
from torch.utils.data import Dataset

from backend.features.rnafm import RNAFMEmbedder
from backend.features.embed_cache import load_embeddings

FEATURE_KEYS = [
    "gc_content",
    "length",
    "au_content",
    "gc_ratio",
    "has_poly_u",
    "has_poly_g",
    "mfe",
    "ensemble_energy",
    "centroid_distance",
]

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


class ASODataset(Dataset):
    """Dataset that combines handcrafted features into a 9-dim tensor."""

    def __init__(self, dataset, feature_keys=None):
        self.dataset = dataset
        self.feature_keys = feature_keys or FEATURE_KEYS

    def __len__(self):
        return len(self.dataset)

    def __getitem__(self, idx):
        sample = self.dataset[idx]

        x = torch.tensor(
            [
                sample["features"]["gc_content"],
                sample["features"]["length"],
                sample["features"]["au_content"],
                sample["features"]["gc_ratio"],
                float(sample["features"]["has_poly_u"]),
                float(sample["features"]["has_poly_g"]),
                sample["features"]["mfe"],
                sample["features"]["ensemble_energy"],
                sample["features"]["centroid_distance"],
            ],
            dtype=torch.float32,
        )

        y = torch.tensor(sample["efficacy"], dtype=torch.float32)

        return x, y


class ASOEmbeddingDataset(Dataset):
    """Dataset backed by precomputed RNA-FM embeddings + accessibility.

    Loads from a cache file produced by embed_cache.precompute_embeddings().
    Returns:
      x: tensor of shape (1280 + 11 = 1291,)  — RNA-FM embeddings concatenated
           with accessibility features.
      y: scalar efficacy.

    If *cache_path* is omitted or the cache does not exist, falls back to
    on-the-fly computation (slow).
    """

    def __init__(self, dataset, embedder=None, cache_path=None):
        self.dataset = dataset
        self._embedder = embedder
        self._cache_path = cache_path
        self._use_cache = cache_path is not None and os.path.exists(cache_path)

        if self._use_cache:
            embs, accs, labels = load_embeddings(cache_path)
            self._cached_x = torch.cat([embs, accs], dim=1)  # (N, 1291)
            self._cached_y = labels
            self._n = len(self._cached_x)
        else:
            if embedder is None:
                embedder = RNAFMEmbedder()
            self._embedder = embedder
            self._n = len(dataset)

    def __len__(self):
        return self._n

    def __getitem__(self, idx):
        if self._use_cache:
            x = self._cached_x[idx]
            y = self._cached_y[idx]
        else:
            sample = self.dataset[idx]
            si_rna_emb = self._embedder.embed(sample["aso_sequence"])
            mrna_emb = self._embedder.embed(sample["mrna_sequence"])
            x = torch.cat([si_rna_emb, mrna_emb], dim=0)
            y = torch.tensor(sample["efficacy"], dtype=torch.float32)

        if not isinstance(y, torch.Tensor):
            y = torch.tensor(y, dtype=torch.float32)

        return x, y


class ASOFusedDataset(Dataset):
    """Dataset that fuses RNA-FM embeddings (1280-dim) with
    handcrafted features (9-dim) + accessibility (11-dim)
    for a 1290-dim input.

    This is the stronger long-term model input.
    """

    def __init__(self, dataset, embedder=None, cache_path=None):
        self.dataset = dataset
        if embedder is None:
            embedder = RNAFMEmbedder()
        self.embedder = embedder
        self._cache_path = cache_path
        self._use_cache = cache_path is not None and os.path.exists(cache_path)

        if self._use_cache:
            self._emb_embs, self._acc_embs, self._labels = load_embeddings(
                cache_path
            )

    def __len__(self):
        return len(self.dataset)

    def __getitem__(self, idx):
        sample = self.dataset[idx]

        if self._use_cache:
            si_rna_emb = self._emb_embs[idx, :640]
            mrna_emb = self._emb_embs[idx, 640:]
            acc = self._acc_embs[idx]
        else:
            si_rna_emb = self.embedder.embed(sample["aso_sequence"])
            mrna_emb = self.embedder.embed(sample["mrna_sequence"])
            from backend.features.accessibility import AccessibilityFeatures
            acc = AccessibilityFeatures.compute(
                sample["mrna_sequence"], sample["aso_sequence"]
            )
            acc = torch.tensor(
                [acc[k] for k in ACCESSIBILITY_KEYS], dtype=torch.float32
            )

        handcrafted = torch.tensor(
            [
                sample["features"]["gc_content"],
                sample["features"]["length"],
                sample["features"]["au_content"],
                sample["features"]["gc_ratio"],
                float(sample["features"]["has_poly_u"]),
                float(sample["features"]["has_poly_g"]),
                sample["features"]["mfe"],
                sample["features"]["ensemble_energy"],
                sample["features"]["centroid_distance"],
            ],
            dtype=torch.float32,
        )

        x = torch.cat([si_rna_emb, mrna_emb, acc, handcrafted], dim=0)

        y = torch.tensor(sample["efficacy"], dtype=torch.float32)

        return x, y
