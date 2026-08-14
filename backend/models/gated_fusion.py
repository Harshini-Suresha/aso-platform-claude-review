"""Gated Fusion Network with feature-family attention.

Instead of simple concatenation + MLP, this model learns a gating
weight for each feature family, allowing the network to decide how
much to trust RNA-FM embeddings vs handcrafted biological features.

Architecture:
  1. Each feature family passes through a small projection layer
  2. A gating score is computed per family via a small attention network
  3. Features are scaled by their gate weights (gated fusion)
  4. Gated features are concatenated and fed through the final MLP

This answers: *Can attention improve utilization of handcrafted
biological descriptors in the presence of 1280-dim RNA-FM embeddings?*
"""

import torch
import torch.nn as nn


class GatedFusionNet(nn.Module):
    """Multi-gate fusion network with feature-family attention.

    Parameters
    ----------
    family_dims : list[int]
        Dimensions of each feature family, e.g. [640, 640, 11, 9]
        for [siRNA_emb, mRNA_emb, accessibility, handcrafted].
    hidden_dims : list[int]
        Hidden layer sizes for the final MLP.
    gate_hidden : int
        Hidden dimension in each family's gate network.
    proj_dim : int
        Projection dimension for each family before gating.
    dropout : float
        Dropout rate in the MLP.
    """

    def __init__(
        self,
        family_dims=None,
        hidden_dims=None,
        gate_hidden=32,
        proj_dim=128,
        dropout=0.2,
    ):
        super().__init__()

        if family_dims is None:
            family_dims = [640, 640, 11, 9]

        if hidden_dims is None:
            hidden_dims = [512, 256, 128, 64]

        self.n_families = len(family_dims)
        self.family_dims = family_dims
        self.proj_dim = proj_dim

        # Per-family projection + gating networks
        self.projections = nn.ModuleList()
        self.gate_networks = nn.ModuleList()

        for d in family_dims:
            # Project each family to a common dimension
            self.projections.append(nn.Sequential(
                nn.Linear(d, proj_dim),
                nn.BatchNorm1d(proj_dim),
                nn.GELU(),
                nn.Dropout(dropout),
            ))

            # Gate network: learns importance weight per family
            # Input is the projection output's mean-pooled summary
            self.gate_networks.append(nn.Sequential(
                nn.Linear(proj_dim, gate_hidden),
                nn.GELU(),
                nn.Linear(gate_hidden, 1),
                nn.Sigmoid(),
            ))

        # Final MLP: takes concatenated gated projections
        mlp_layers = []
        in_dim = proj_dim * self.n_families
        for h_dim in hidden_dims:
            mlp_layers.append(nn.Linear(in_dim, h_dim))
            mlp_layers.append(nn.BatchNorm1d(h_dim))
            mlp_layers.append(nn.GELU())
            mlp_layers.append(nn.Dropout(dropout))
            in_dim = h_dim
        mlp_layers.append(nn.Linear(in_dim, 1))
        self.mlp = nn.Sequential(*mlp_layers)

    def forward(self, x):
        """Forward pass.

        Parameters
        ----------
        x : torch.Tensor
            Input tensor of shape (N, sum(family_dims)).
            Features are expected in family order: [siRNA, mRNA, acc, hc].
        """
        # Split input by family
        families = []
        offset = 0
        for d in self.family_dims:
            families.append(x[:, offset:offset + d])
            offset += d

        # Project each family and compute gate weight
        gated_features = []
        gate_weights = []

        for i, (fam, proj, gate) in enumerate(zip(families, self.projections, self.gate_networks)):
            feat = proj(fam)  # (N, proj_dim)
            gate_val = gate(feat)  # (N, 1) — scalar gate per sample per family
            gated = feat * gate_val  # scale features by gate
            gated_features.append(gated)
            gate_weights.append(gate_val.squeeze(-1))

        # Concatenate gated projections
        combined = torch.cat(gated_features, dim=1)  # (N, proj_dim * n_families)

        # Final MLP
        output = self.mlp(combined).squeeze(-1)
        return output

    def get_gate_weights(self, x):
        """Return per-family gate weights for analysis/explainability.

        Returns a tensor of shape (N, n_families).
        """
        families = []
        offset = 0
        for d in self.family_dims:
            families.append(x[:, offset:offset + d])
            offset += d

        weights = []
        for fam, proj, gate in zip(families, self.projections, self.gate_networks):
            feat = proj(fam)
            gate_val = gate(feat).squeeze(-1)
            weights.append(gate_val)

        return torch.stack(weights, dim=1)  # (N, n_families)

    def get_family_names(self):
        return ["rnafm_siRNA", "rnafm_mRNA", "accessibility", "handcrafted"]
