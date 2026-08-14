import torch.nn as nn


class FusionNet(nn.Module):
    def __init__(self, input_dim: int = 1300, hidden_dims: list = None, dropout: float = 0.3):
        super().__init__()

        if hidden_dims is None:
            hidden_dims = [512, 256, 128, 64]

        layers = []
        in_dim = input_dim
        for h_dim in hidden_dims:
            layers.append(nn.Linear(in_dim, h_dim))
            layers.append(nn.BatchNorm1d(h_dim))
            layers.append(nn.GELU())
            layers.append(nn.Dropout(dropout))
            in_dim = h_dim

        layers.append(nn.Linear(in_dim, 1))

        self.model = nn.Sequential(*layers)

    def forward(self, x):
        return self.model(x).squeeze(-1)