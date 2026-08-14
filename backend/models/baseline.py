import torch.nn as nn


class BaselineMLP(nn.Module):
    def __init__(self, input_dim: int = 9, hidden_dim: int = 64):
        super().__init__()

        self.model = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1),
        )

    def forward(self, x):
        return self.model(x).squeeze(-1)
