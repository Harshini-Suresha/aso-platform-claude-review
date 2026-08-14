"""Token-Level Cross-Attention model for ASO efficacy prediction (Phase 12+).

Core design (unchanged from the Phase 12 spec):
  proj(640->256) -> cross-attn(query=ASO, key/value=target, 8 heads)
  -> self-attn(ASO) -> mean pool -> concat acc(11)+hc(9) -> head -> 1

Optional v1-style enhancements (all OFF by default; enable via flags so the
pure Phase 12 configuration stays reproducible):
  token_norm         LayerNorm on projected tokens
  use_pos_encoding   learnable positional embeddings (ASO / target)
  target_encoder     transformer encoder block on the target before
                     cross-attention (encodes secondary-structure context)
  num_target_blocks  number of transformer blocks for target encoder (default 1)
  aso_self_attn      self-attention over ASO tokens before cross-attention
  cross_residual     residual connection + LayerNorm after cross-attention
  use_target_pool    include the mean-pooled target representation in the
                     head input
  use_bilinear       include the elementwise interaction ASO_pool * target_pool

The head uses BatchNorm1d (the convention of every prior model in this repo);
without it the head underfits and the cross-attention never specializes.

No attention mask: the Huesken window has fixed lengths (19 / 57 nt).
``forward`` returns ``(prediction, attention_weights)``; the last attention
weights are cached on the module (``self.last_attention``) in eval mode.
"""

import torch
import torch.nn as nn


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


class TokenCrossAttention(nn.Module):
    """Nucleotide-level cross-attention model (Phase 12).

    Parameters
    ----------
    rnafm_dim : int
        Per-token RNA-FM embedding dimension (default 640).
    d_model : int
        Transformer hidden / projection dimension (default 256).
    n_heads : int
        Number of attention heads (default 8).
    acc_dim : int
        Accessibility feature dimension (default 11).
    hc_dim : int
        Handcrafted feature dimension (default 9).
    dropout : float
        Dropout rate (default 0.2).
    aso_len, target_len : int
        Token lengths; only used when positional encoding is enabled.
    token_norm : bool
        Apply LayerNorm to the projected tokens (default False).
    use_pos_encoding : bool
        Add learnable positional embeddings (default False).
    target_encoder : bool
        Encode the target with a transformer block before cross-attention
        (default False).
    cross_residual : bool
        Residual + LayerNorm around the cross-attention output
        (default False).
    use_target_pool : bool
        Concatenate the mean-pooled target representation to the head input
        (default False).
    use_bilinear : bool
        Concatenate the elementwise ASO * target interaction to the head
        input (default False).
    """

    def __init__(
        self,
        rnafm_dim: int = 640,
        d_model: int = 256,
        n_heads: int = 8,
        acc_dim: int = 11,
        hc_dim: int = 9,
        dropout: float = 0.2,
        aso_len: int = 19,
        target_len: int = 57,
        token_norm: bool = False,
        use_pos_encoding: bool = False,
        target_encoder: bool = False,
        num_target_blocks: int = 1,
        aso_self_attn: bool = False,
        cross_residual: bool = False,
        use_target_pool: bool = False,
        use_bilinear: bool = False,
    ):
        super().__init__()

        self.rnafm_dim = rnafm_dim
        self.d_model = d_model
        self.n_heads = n_heads
        self.acc_dim = acc_dim
        self.hc_dim = hc_dim
        self.aso_len = aso_len
        self.target_len = target_len

        self.token_norm = token_norm
        self.use_pos_encoding = use_pos_encoding
        self.target_encoder = target_encoder
        self.num_target_blocks = num_target_blocks
        self.aso_self_attn = aso_self_attn
        self.cross_residual = cross_residual
        self.use_target_pool = use_target_pool
        self.use_bilinear = use_bilinear

        # Projection layers: reduce 640-dim tokens to 256-dim
        self.aso_proj = nn.Linear(rnafm_dim, d_model)
        self.target_proj = nn.Linear(rnafm_dim, d_model)

        if token_norm:
            self.aso_norm = nn.LayerNorm(d_model)
            self.target_norm = nn.LayerNorm(d_model)

        if use_pos_encoding:
            self.aso_pos = nn.Embedding(aso_len, d_model)
            self.target_pos = nn.Embedding(target_len, d_model)

        if target_encoder:
            self.target_encoder_block = nn.ModuleList([
                _TransformerBlock(d_model, n_heads, dropout)
                for _ in range(num_target_blocks)
            ])

        if aso_self_attn:
            self.aso_self_attention = nn.MultiheadAttention(
                embed_dim=d_model,
                num_heads=n_heads,
                batch_first=True,
            )
            self.aso_self_norm = nn.LayerNorm(d_model)

        # Cross-attention: ASO (query) attends over target (key/value)
        self.cross_attention = nn.MultiheadAttention(
            embed_dim=d_model,
            num_heads=n_heads,
            batch_first=True,
        )

        if cross_residual:
            self.cross_norm = nn.LayerNorm(d_model)

        # Self-attention over the attended ASO representation
        self.self_attention = nn.MultiheadAttention(
            embed_dim=d_model,
            num_heads=n_heads,
            batch_first=True,
        )

        # Head input: aso_pool + (target_pool) + (bilinear) + acc + hc
        head_in = d_model
        if use_target_pool:
            head_in += d_model
        if use_bilinear:
            head_in += d_model
        head_in += acc_dim + hc_dim

        self.head = nn.Sequential(
            nn.Linear(head_in, 256),
            nn.BatchNorm1d(256),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(256, 128),
            nn.BatchNorm1d(128),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(128, 64),
            nn.BatchNorm1d(64),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
        )

        # Instrumentation: last cross-attention weights (eval mode only)
        self.last_attention = None

    def forward(self, aso_tokens, target_tokens, accessibility, handcrafted):
        """Forward pass.

        Parameters
        ----------
        aso_tokens : torch.Tensor
            (N, 19, 640) per-nucleotide ASO token embeddings.
        target_tokens : torch.Tensor
            (N, 57, 640) per-nucleotide target token embeddings.
        accessibility : torch.Tensor
            (N, 11) accessibility features.
        handcrafted : torch.Tensor
            (N, 9) handcrafted features.

        Returns
        -------
        (prediction, attention_weights)
            prediction: (N,) efficacy estimates.
            attention_weights: (N, 19, 57) cross-attention weights averaged
            over heads (ASO position -> target position).
        """
        device = aso_tokens.device

        aso = self.aso_proj(aso_tokens)            # (N, 19, 256)
        target = self.target_proj(target_tokens)   # (N, 57, 256)

        if self.token_norm:
            aso = self.aso_norm(aso)
            target = self.target_norm(target)

        if self.use_pos_encoding:
            aso = aso + self.aso_pos(
                torch.arange(self.aso_len, device=device)
            ).unsqueeze(0)
            target = target + self.target_pos(
                torch.arange(self.target_len, device=device)
            ).unsqueeze(0)

        if self.target_encoder:
            for block in self.target_encoder_block:
                target = block(target)

        if self.aso_self_attn:
            aso, _ = self.aso_self_attention(
                aso, aso, aso, need_weights=False
            )
            aso = self.aso_self_norm(aso + aso)

        aso_attended, attn_weights = self.cross_attention(
            query=aso,
            key=target,
            value=target,
        )                                          # (N, 19, 256), (N, 19, 57)

        if self.cross_residual:
            aso_attended = self.cross_norm(aso + aso_attended)

        aso_attended, _ = self.self_attention(
            aso_attended, aso_attended, aso_attended, need_weights=False
        )

        aso_representation = aso_attended.mean(dim=1)  # (N, 256)

        feats = [aso_representation]
        if self.use_target_pool:
            target_representation = target.mean(dim=1)  # (N, 256)
            feats.append(target_representation)
        if self.use_bilinear:
            feats.append(aso_representation * target_representation)

        x = torch.cat(feats + [accessibility, handcrafted], dim=1)

        prediction = self.head(x).squeeze(-1)     # (N,)

        if not self.training:
            self.last_attention = attn_weights.detach()

        return prediction, attn_weights
