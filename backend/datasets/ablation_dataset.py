"""Ablation dataset: pre-loads all features once and slices based on
the requested feature *family* (handcrafted, rnafm, accessibility, or
combinations).  This avoids recomputing RNA-FM embeddings or
accessibility features for every experiment — it just indexes into
tensors that were already cached.
"""

import torch
from torch.utils.data import Dataset

from backend.features.embed_cache import CACHE_FILE, ACCESSIBILITY_KEYS
from backend.datasets.huesken import HueskenDataset
from backend.features.extractor import FeatureExtractor

HANDSCRFTED_KEYS = [
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

HANDSCRFTED_DIM = len(HANDSCRFTED_KEYS)        # 9
ACCESSIBILITY_DIM = len(ACCESSIBILITY_KEYS)     # 11
RNAFM_DIM = 1280                                  # 2 × 640

# Mapping: experiment name -> (slice description, start, end)
FEATURE_RANGES = {
    "rnafm_si":       (0, 640),
    "rnafm_mrna":     (640, 1280),
    "rnafm":          (0, 1280),
    "accessibility":  (1280, 1280 + ACCESSIBILITY_DIM),
    "handcrafted":    (1280 + ACCESSIBILITY_DIM, 1280 + ACCESSIBILITY_DIM + HANDSCRFTED_DIM),
}


class AblationDataset(Dataset):
    """Dataset that loads the full feature tensor (RNA-FM + accessibility
    + handcrafted) once at construction time, then returns a *sliced*
    version based on ``feature_families``.

    Parameters
    ----------
    dataset : HueskenDataset
        The base dataset for handcrafted feature computation.
    cache_path : str
        Path to the precomputed .pt cache (embeddings + accessibility).
    feature_families : list[str]
        One or more of: ``"handcrafted"``, ``"rnafm"``, ``"accessibility"``.
        The order is fixed:  [siRNA_emb, mRNA_emb, accessibility, handcrafted]
        so that every experiment sees exactly the same column ordering.
    """

    ALL_FAMILIES = ["rnafm", "accessibility", "handcrafted"]

    def __init__(self, dataset, cache_path=None, feature_families=None):
        self.dataset = dataset

        if cache_path is None:
            cache_path = CACHE_FILE

        import os
        if not os.path.exists(cache_path):
            raise FileNotFoundError(
                f"Cache not found at {cache_path}. "
                "Run backend.features.embed_cache.precompute_embeddings() first."
            )

        data = torch.load(cache_path, weights_only=True)
        self._rnafm = data["embeddings"]       # (N, 1280)  [siRNA|640 + mRNA|640]
        self._acc = data["accessibility"]      # (N, 11)
        self._labels = data["labels"]          # (N,)

        # Pre-compute handcrafted features once
        n = len(dataset)
        handcrafted = torch.zeros(n, HANDSCRFTED_DIM, dtype=torch.float32)
        for i in range(n):
            feats = dataset[i]["features"]
            handcrafted[i] = torch.tensor(
                [feats[k] for k in HANDSCRFTED_KEYS],
                dtype=torch.float32,
            )
        self._handcrafted = handcrafted  # (N, 9)

        # Assemble the full tensor in fixed column order
        self._full_x = torch.cat(
            [self._rnafm, self._acc, self._handcrafted], dim=1
        )  # (N, 1300)

        self._n = n

        if feature_families is None:
            feature_families = self.ALL_FAMILIES
        self.feature_families = list(feature_families)

        # Compute column slices
        self._slices = self._compute_slices()

    def _compute_slices(self):
        """Return list of (start, end) column slices for the requested families."""
        family_to_cols = {
            "rnafm": (0, RNAFM_DIM),
            "accessibility": (RNAFM_DIM, RNAFM_DIM + ACCESSIBILITY_DIM),
            "handcrafted": (
                RNAFM_DIM + ACCESSIBILITY_DIM,
                RNAFM_DIM + ACCESSIBILITY_DIM + HANDSCRFTED_DIM,
            ),
        }
        slices = []
        for fam in self.feature_families:
            if fam not in family_to_cols:
                raise ValueError(f"Unknown feature family: {fam}")
            slices.append(family_to_cols[fam])
        return slices

    @property
    def input_dim(self):
        return sum(end - start for start, end in self._slices)

    def __len__(self):
        return self._n

    def __getitem__(self, idx):
        parts = []
        for start, end in self._slices:
            parts.append(self._full_x[idx, start:end])
        x = torch.cat(parts, dim=0)
        y = self._labels[idx]
        return x, y


def auto_architecture(input_dim):
    """Pick a reasonable architecture based on input dimension."""
    if input_dim <= 50:
        return [64, 32]
    elif input_dim <= 200:
        return [256, 128, 64]
    else:
        return [512, 256, 128, 64]


ABLATED_EXPERIMENTS = {
    "exp01_handcrafted": {
        "feature_families": ["handcrafted"],
        "description": "Handcrafted features only (9-dim)",
        "input_dim": HANDSCRFTED_DIM,
    },
    "exp02_rnafm": {
        "feature_families": ["rnafm"],
        "description": "RNA-FM embeddings only (1280-dim)",
        "input_dim": RNAFM_DIM,
    },
    "exp03_accessibility": {
        "feature_families": ["accessibility"],
        "description": "Accessibility features only (11-dim)",
        "input_dim": ACCESSIBILITY_DIM,
    },
    "exp04_rnafm_accessibility": {
        "feature_families": ["rnafm", "accessibility"],
        "description": "RNA-FM + Accessibility (1291-dim)",
        "input_dim": RNAFM_DIM + ACCESSIBILITY_DIM,
    },
    "exp05_rnafm_handcrafted": {
        "feature_families": ["rnafm", "handcrafted"],
        "description": "RNA-FM + Handcrafted (1289-dim)",
        "input_dim": RNAFM_DIM + HANDSCRFTED_DIM,
    },
    "exp06_fusion": {
        "feature_families": ["rnafm", "accessibility", "handcrafted"],
        "description": "Full FusionNet (1300-dim)",
        "input_dim": RNAFM_DIM + ACCESSIBILITY_DIM + HANDSCRFTED_DIM,
    },
}
