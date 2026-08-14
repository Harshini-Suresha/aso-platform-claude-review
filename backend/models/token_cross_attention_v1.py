"""Token-level Cross-Attention Transformer for ASO efficacy prediction.

Phase 11 model — SUPERSEDED by the Phase 12 TokenCrossAttention (see
``backend/models/token_cross_attention.py``). Kept so the exp11 experiment
remains reproducible. Earlier models consumed ONE mean-pooled 640-dim vector per
sequence (see ``backend/features/rnafm.py``). This model instead consumes the
full per-nucleotide RNA-FM token embeddings:

  ASO token embeddings     : (N, 19, 640)   (19 nt, constant length)
  Target token embeddings  : (N, 57, 640)   (57 nt, constant length)

Huesken targets are pre-windowed (19 nt upstream + 19 nt binding site + 19 nt
downstream), so fixed lengths mean NO padding and NO attention mask.

Architecture
------------
1. Per-token linear projections to ``d_model`` (shared across positions).
2. Learnable positional encodings. RNA-FM token embeddings carry no
   positional information, so these are required for nucleotide order.
3. Target self-attention (1 transformer encoder block) — encodes
   secondary-structure context across the 57-nt window.
4. Cross-attention: ASO positions (query) attend over target positions
   (key/value) — the nucleotide-level ASO-target interaction.
5. Mean-pool the attended ASO tokens and the target context tokens.
6. Elementwise (Hadamard) bilinear interaction of the two pooled vectors.
7. Gated accessibility + handcrafted biological features (same scheme as
   GatedFusionNet / CrossAttentionFusion).
8. Shared MLP prediction head [512, 256, 128, 64].

Training protocol is IDENTICAL to previous experiments (5-fold CV seed 42,
Adam, MSE, lr=1e-3, dropout=0.2, weight_decay=1e-5, batch=32, patience=10,
100 epochs) so any gain is attributable to the token-level interaction.
"""

import torch
import torch.nn as nn

ASO_LEN = 19
TARGET_LEN = 57


class _TransformerBlock(nn.Module):
    """Single transformer encoder block: MHSA + residual + LayerNorm + FFN."""

    def __init__(self, d_model: int, n_heads: int, dropout: float = 0.2):
        super().__init__()
        self.attn = nn.MultiheadAttention(
            d_model, n_heads, dropout=dropout, batch_first=True
        )
        self.norm1 = nn.LayerNorm(d_model)
        self.ff = nn.Sequential(
            nn.Linear(d_model, 4 * d_model),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(4 * d_model, d_model),
            nn.Dropout(dropout),
        )
        self.norm2 = nn.LayerNorm(d_model)

    def forward(self, x):
        a, _ = self.attn(x, x, x, need_weights=False)
        x = self.norm1(x + a)
        x = self.norm2(x + self.ff(x))
        return x


class TokenCrossAttentionV1(nn.Module):
    """Token-level cross-attention transformer.

    Parameters
    ----------
    rnafm_dim : int
        Per-token RNA-FM embedding dimension (default 640).
    d_model : int
        Transformer hidden dimension (default 128).
    n_heads : int
        Number of attention heads (default 4).
    aso_len : int
        ASO nucleotide length (default 19).
    target_len : int
        Target nucleotide length (default 57).
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
        d_model: int = 128,
        n_heads: int = 4,
        aso_len: int = ASO_LEN,
        target_len: int = TARGET_LEN,
        acc_dim: int = 11,
        hc_dim: int = 9,
        gate_hidden: int = 32,
        dropout: float = 0.2,
        hidden_dims: list = None,
    ):
        super().__init__()

        if hidden_dims is None:
            hidden_dims = [512, 256, 128, 64]

        self.d_model = d_model
        self.aso_len = aso_len
        self.target_len = target_len

        self.aso_proj = self._token_block(rnafm_dim, d_model, dropout)
        self.mr_proj = self._token_block(rnafm_dim, d_model, dropout)
        self.aso_pos = nn.Embedding(aso_len, d_model)
        self.mr_pos = nn.Embedding(target_len, d_model)

        self.target_encoder = _TransformerBlock(d_model, n_heads, dropout)
        self.cross_attn = nn.MultiheadAttention(
            d_model, n_heads, dropout=dropout, batch_first=True
        )
        self.norm = nn.LayerNorm(d_model)

        self.acc_gate = self._gate_net(acc_dim, gate_hidden)
        self.hc_gate = self._gate_net(hc_dim, gate_hidden)

        head_in = d_model * 3 + acc_dim + hc_dim  # aso_pool + mr_pool + bilinear + acc + hc
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
    def _token_block(in_dim, out_dim, dropout):
        # Applied per-token over sequences (N, L, D) -> LayerNorm, not
        # BatchNorm1d (which would treat L as the channel dimension).
        return nn.Sequential(
            nn.Linear(in_dim, out_dim),
            nn.LayerNorm(out_dim),
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

    def _encode(self, aso_tokens, mrna_tokens):
        """Project + add positional encoding + target self-attention.

        Returns (aso_tok, target_ctx) where aso_tok is (N, aso_len, D)
        and target_ctx is (N, target_len, D).
        """
        device = aso_tokens.device

        aso_tok = self.aso_proj(aso_tokens) + self.aso_pos(
            torch.arange(self.aso_len, device=device)
        ).unsqueeze(0)

        mr_tok = self.mr_proj(mrna_tokens) + self.mr_pos(
            torch.arange(self.target_len, device=device)
        ).unsqueeze(0)

        target_ctx = self.target_encoder(mr_tok)
        return aso_tok, target_ctx

    def _forward_impl(self, aso_tokens, mrna_tokens, acc, hc, return_attn):
        aso_tok, target_ctx = self._encode(aso_tokens, mrna_tokens)

        if return_attn:
            attn_out, attn_w = self.cross_attn(
                aso_tok, target_ctx, target_ctx,
                need_weights=True, average_attn_weights=True,
            )  # attn_w: (N, aso_len, target_len) averaged over heads
        else:
            attn_out, _ = self.cross_attn(
                aso_tok, target_ctx, target_ctx, need_weights=False
            )
            attn_w = None

        aso_attended = self.norm(aso_tok + attn_out)  # residual
        aso_pool = aso_attended.mean(dim=1)  # (N, D)
        mr_pool = target_ctx.mean(dim=1)     # (N, D)
        bilinear = aso_pool * mr_pool

        acc_g = acc * self.acc_gate(acc)
        hc_g = hc * self.hc_gate(hc)

        feat = torch.cat([aso_pool, mr_pool, bilinear, acc_g, hc_g], dim=1)
        out = self.head(feat).squeeze(-1)
        return out, attn_w

    def forward(self, aso_tokens, mrna_tokens, acc, hc):
        """Forward pass.

        Parameters
        ----------
        aso_tokens : torch.Tensor
            (N, 19, 640) per-nucleotide ASO token embeddings.
        mrna_tokens : torch.Tensor
            (N, 57, 640) per-nucleotide target token embeddings.
        acc : torch.Tensor
            (N, 11) accessibility features.
        hc : torch.Tensor
            (N, 9) handcrafted features.
        """
        out, _ = self._forward_impl(aso_tokens, mrna_tokens, acc, hc, False)
        return out

    def get_attention_weights(self, aso_tokens, mrna_tokens, acc, hc):
        """Return the ASO-position x target-position cross-attention matrix.

        Averaged over attention heads and the given batch. Returns a
        tensor of shape (aso_len, target_len).
        """
        _, attn_w = self._forward_impl(aso_tokens, mrna_tokens, acc, hc, True)
        return attn_w.mean(dim=0)  # (aso_len, target_len)
