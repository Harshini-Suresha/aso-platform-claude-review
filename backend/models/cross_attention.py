"""Cross-feature interaction model for ASO efficacy prediction.

IMPORTANT NOTE ON EMBEDDINGS
----------------------------
RNA-FM embeddings in this pipeline are MEAN-POOLED to a single 640-dim
vector per sequence (see ``backend/features/rnafm.py``: ``token_embeddings
.mean(dim=1)``). The embedding cache therefore stores one fixed 640-dim
vector per sequence, NOT per-nucleotide token embeddings (``L x 640``).

Because of that, a true nucleotide-level cross-attention transformer is not
possible with the cached features: ``nn.MultiheadAttention`` over a single
token (sequence length 1) would be a no-op. This module implements the
required fallback — an explicit CROSS-FEATURE interaction module:

  1. Project each 640-dim sequence embedding to a common dimension.
  2. Feature-level cross-attention: for every ASO (siRNA) feature, attend
     over target (mRNA) features via scaled dot-product over the projected
     feature space (query = ASO, key/value = target).
  3. Elementwise (Hadamard) bilinear interaction term si ⊙ mr.
  4. Gated fusion of accessibility + handcrafted biological features
     (same gating scheme as GatedFusionNet).
  5. Shared MLP prediction head.

To run a true nucleotide-level transformer in a later phase, re-extract
token embeddings (``L x 640``) from RNA-FM (skip the mean pool), store them
per sample, and feed the token sequences as query/key/value.
"""

import torch
import torch.nn as nn


class CrossAttentionFusion(nn.Module):
    """Cross-feature interaction fusion model.

    Parameters
    ----------
    rnafm_dim : int
        Dimension of each pooled RNA-FM embedding (default 640).
    proj_dim : int
        Projection dimension used for cross-feature attention
        (default 256).
    acc_dim : int
        Accessibility feature dimension (default 11).
    hc_dim : int
        Handcrafted feature dimension (default 9).
    gate_hidden : int
        Hidden size of each biological-feature gate network (default 32).
    dropout : float
        Dropout rate (default 0.2).
    hidden_dims : list[int]
        Hidden layer sizes of the prediction head MLP
        (default [512, 256, 128, 64]).
    """

    def __init__(
        self,
        rnafm_dim: int = 640,
        proj_dim: int = 256,
        acc_dim: int = 11,
        hc_dim: int = 9,
        gate_hidden: int = 32,
        dropout: float = 0.2,
        hidden_dims: list = None,
    ):
        super().__init__()

        if hidden_dims is None:
            hidden_dims = [512, 256, 128, 64]

        self.proj_dim = proj_dim
        self.acc_dim = acc_dim
        self.hc_dim = hc_dim

        # Per-sequence projections
        self.si_proj = self._block(rnafm_dim, proj_dim, dropout)
        self.mr_proj = self._block(rnafm_dim, proj_dim, dropout)

        # Cross-feature attention over the projected feature space.
        # Treat each of the proj_dim features as a token: for every ASO
        # feature we compute a soft weighted combination of target features.
        self.W_q = nn.Linear(proj_dim, proj_dim, bias=False)
        self.W_k = nn.Linear(proj_dim, proj_dim, bias=False)
        self.W_v = nn.Linear(proj_dim, proj_dim, bias=False)
        self.attn_scale = proj_dim ** -0.5

        # Biological feature gates (same pattern as GatedFusionNet)
        self.acc_gate = self._gate_net(acc_dim, gate_hidden)
        self.hc_gate = self._gate_net(hc_dim, gate_hidden)

        # Prediction head
        head_in = proj_dim * 3 + acc_dim + hc_dim  # attended + target + bilinear + acc + hc
        layers = []
        in_dim = head_in
        for h in hidden_dims:
            layers += [
                nn.Linear(in_dim, h),
                nn.BatchNorm1d(h),
                nn.GELU(),
                nn.Dropout(dropout),
            ]
            in_dim = h
        layers.append(nn.Linear(in_dim, 1))
        self.head = nn.Sequential(*layers)

    @staticmethod
    def _block(in_dim, out_dim, dropout):
        return nn.Sequential(
            nn.Linear(in_dim, out_dim),
            nn.BatchNorm1d(out_dim),
            nn.GELU(),
            nn.Dropout(dropout),
        )

    @staticmethod
    def _gate_net(in_dim, hidden):
        return nn.Sequential(
            nn.Linear(in_dim, hidden),
            nn.GELU(),
            nn.Linear(hidden, 1),
            nn.Sigmoid(),
        )

    def forward(self, x):
        """Forward pass.

        Parameters
        ----------
        x : torch.Tensor
            (N, 1300) with columns [siRNA(640), mRNA(640), acc(11), hc(9)].
        """
        si = x[:, :640]
        mr = x[:, 640:1280]
        acc = x[:, 1280:1280 + self.acc_dim]
        hc = x[:, 1280 + self.acc_dim:1280 + self.acc_dim + self.hc_dim]

        si_p = self.si_proj(si)  # (N, proj_dim)
        mr_p = self.mr_proj(mr)  # (N, proj_dim)

        # Cross-feature attention: ASO (query) attends over target (key/value)
        q = self.W_q(si_p)                       # (N, proj_dim)
        k = self.W_k(mr_p)                       # (N, proj_dim)
        v = self.W_v(mr_p)                       # (N, proj_dim)

        scores = torch.bmm(q.unsqueeze(2), k.unsqueeze(1)) * self.attn_scale  # (N, P, P)
        attn = torch.softmax(scores, dim=-1)
        attended = torch.bmm(attn, v.unsqueeze(2)).squeeze(2)                  # (N, P)

        # Residual: keep the ASO projection in the attended vector
        attended = attended + si_p

        # Elementwise bilinear interaction
        bilinear = si_p * mr_p

        # Gated biological features
        acc_g = acc * self.acc_gate(acc)
        hc_g = hc * self.hc_gate(hc)

        feat = torch.cat([attended, mr_p, bilinear, acc_g, hc_g], dim=1)
        return self.head(feat).squeeze(-1)

    def get_attention_weights(self, x):
        """Return the cross-feature attention matrix averaged over a batch.

        Returns a tensor of shape (proj_dim, proj_dim): for each ASO feature
        row, the soft weight distribution over target features.
        """
        si = x[:, :640]
        mr = x[:, 640:1280]
        si_p = self.si_proj(si)
        mr_p = self.mr_proj(mr)

        q = self.W_q(si_p)
        k = self.W_k(mr_p)
        scores = torch.bmm(q.unsqueeze(2), k.unsqueeze(1)) * self.attn_scale
        attn = torch.softmax(scores, dim=-1)
        return attn.mean(dim=0)
