"""Token-level dataset for the nucleotide cross-attention transformer.

Backed by the per-nucleotide token cache ``backend/data/hu_token_embeddings.pt``
(see ``backend/features/embed_cache.py::precompute_token_embeddings``).

Each sample is returned as a dict:

    {
        "aso_tokens":      (L_aso, 640)    per-nucleotide ASO embeddings
        "target_tokens":   (L_target, 640) per-nucleotide target embeddings
        "accessibility":   (11,)           RNAplfold-style features
        "handcrafted":     (9,)            thermodynamic / compositional features
        "label":           scalar          continuous efficacy
    }

Note on shapes: the Huesken dataset has fixed lengths (ASO 19 nt, target
57 nt), so in practice ``L_aso = 19`` and ``L_target = 57``. The class
derives shapes from the cache and does not hardcode them.

If *cache_path* is omitted or does not exist, falls back to on-the-fly
computation (slow; requires ViennaRNA).
"""

import os

import torch
from torch.utils.data import Dataset

from backend.features.rnafm import RNAFMEmbedder
from backend.features.accessibility import AccessibilityFeatures
from backend.features.embed_cache import (
    ACCESSIBILITY_KEYS,
    TOKEN_CACHE_FILE,
    load_token_embeddings,
)
from backend.datasets.ablation_dataset import (
    HANDSCRFTED_KEYS,
)


class TokenDataset(Dataset):
    """Dataset of per-nucleotide RNA-FM token embeddings + biological features.

    Parameters
    ----------
    dataset : HueskenDataset
        Base dataset (used for the on-the-fly fallback and handcrafted
        features when the cache is absent).
    embedder : RNAFMEmbedder, optional
        Only needed for the on-the-fly fallback.
    cache_path : str, optional
        Path to ``hu_token_embeddings.pt``. If None, uses the default
        TOKEN_CACHE_FILE.
    """

    def __init__(self, dataset, embedder=None, cache_path=None):
        self.dataset = dataset
        self._embedder = embedder
        self._cache_path = cache_path or TOKEN_CACHE_FILE
        self._use_cache = os.path.exists(self._cache_path)

        if self._use_cache:
            self._aso_tokens, self._target_tokens, self._accessibility, \
                self._handcrafted, self._labels = load_token_embeddings(
                    self._cache_path
                )
            self._n = len(self._labels)
            self.aso_len = self._aso_tokens.shape[1]
            self.target_len = self._target_tokens.shape[1]
        else:
            if embedder is None:
                embedder = RNAFMEmbedder()
            self._embedder = embedder
            self._n = len(dataset)
            self.aso_len = None
            self.target_len = None

    def __len__(self):
        return self._n

    def __getitem__(self, idx):
        if self._use_cache:
            aso_tokens = self._aso_tokens[idx]           # (L_aso, 640)
            target_tokens = self._target_tokens[idx]     # (L_target, 640)
            accessibility = self._accessibility[idx]     # (11,)
            handcrafted = self._handcrafted[idx]         # (9,)
            label = self._labels[idx]
        else:
            sample = self.dataset[idx]

            aso = self._embedder.embed_with_tokens(sample["aso_sequence"])
            target = self._embedder.embed_with_tokens(sample["mrna_sequence"])
            aso_tokens = aso["nucleotide_embeddings"]
            target_tokens = target["nucleotide_embeddings"]

            acc = AccessibilityFeatures.compute(
                sample["mrna_sequence"], sample["aso_sequence"]
            )
            accessibility = torch.tensor(
                [acc[k] for k in ACCESSIBILITY_KEYS], dtype=torch.float32
            )

            handcrafted = torch.tensor(
                [sample["features"][k] for k in HANDSCRFTED_KEYS],
                dtype=torch.float32,
            )

            label = torch.tensor(sample["efficacy"], dtype=torch.float32)

        if not isinstance(label, torch.Tensor):
            label = torch.tensor(label, dtype=torch.float32)

        return {
            "aso_tokens": aso_tokens,
            "target_tokens": target_tokens,
            "accessibility": accessibility,
            "handcrafted": handcrafted,
            "label": label,
        }
