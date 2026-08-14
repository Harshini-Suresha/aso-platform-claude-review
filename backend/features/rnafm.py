import argparse
import os

import torch

from fm.pretrained import load_model_and_alphabet_local

_torch_globals_added = False
_instance = None


def _ensure_safe_globals():
    global _torch_globals_added
    if not _torch_globals_added:
        torch.serialization.add_safe_globals([argparse.Namespace])
        _torch_globals_added = True


class RNAFMEmbedder:
    """Singleton wrapper around the RNA-FM pretrained model.

    Handles one-time model loading and provides sequence-level
    embedding extraction via mean pooling over nucleotide tokens.
    """

    _instance = None
    _initialized = False

    def __new__(cls, model_path: str = None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, model_path: str = None):
        if RNAFMEmbedder._initialized:
            return

        _ensure_safe_globals()

        if model_path is None:
            model_path = "backend/pretrained/RNA-FM_pretrained.pth"

        if not os.path.exists(model_path):
            from fm.pretrained import rna_fm_t12
            self.model, self.alphabet = rna_fm_t12()
        else:
            self.model, self.alphabet = load_model_and_alphabet_local(
                model_path, theme="rna"
            )

        self.model.eval()
        self.batch_converter = self.alphabet.get_batch_converter()
        self.embedding_dim = 640
        self.layer = 12

        RNAFMEmbedder._initialized = True

    def embed(self, sequence: str) -> torch.Tensor:
        """Return a 640-dim mean-pooled embedding for a single RNA sequence."""
        sequence = sequence.upper().replace("T", "U")

        data = [("seq", sequence)]
        _, _, tokens = self.batch_converter(data)

        with torch.no_grad():
            results = self.model(tokens, repr_layers=[self.layer])

        token_embeddings = results["representations"][self.layer]
        # Mean pool over sequence dimension (excluding padding if present)
        embedding = token_embeddings.mean(dim=1)  # (1, 640)

        return embedding.squeeze(0)  # (640,)

    def embed_batch(self, sequences):
        """Embed a list of RNA sequences. Returns (N, 640) tensor."""
        data = [(f"seq_{i}", seq.upper().replace("T", "U")) for i, seq in enumerate(sequences)]
        _, _, tokens = self.batch_converter(data)

        with torch.no_grad():
            results = self.model(tokens, repr_layers=[self.layer])

        token_embeddings = results["representations"][self.layer]
        embeddings = token_embeddings.mean(dim=1)  # (N, 640)

        return embeddings


def get_embedder(model_path: str = None) -> RNAFMEmbedder:
    if not RNAFMEmbedder._initialized:
        RNAFMEmbedder(model_path)
    return RNAFMEmbedder._instance
