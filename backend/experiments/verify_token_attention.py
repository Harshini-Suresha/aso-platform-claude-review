"""Phase 12 verification: tensor shapes, forward pass, attention weights,
and gradient flow for TokenCrossAttention.

Run: python backend/experiments/verify_token_attention.py

Expected (batch, d_model=256):
  ASO            (B, 19, 256)
  Target         (B, 57, 256)
  Attention out  (B, 19, 256)
  Final (head in) (B, 276)
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import torch

from backend.models.token_cross_attention import TokenCrossAttention


def verify_on_synthetic(seed=0):
    """Verify shapes + gradients on random tensors."""
    torch.manual_seed(seed)
    model = TokenCrossAttention(d_model=256, n_heads=8)

    B = 4
    aso_tokens = torch.randn(B, 19, 640)
    target_tokens = torch.randn(B, 57, 640)
    accessibility = torch.randn(B, 11)
    handcrafted = torch.randn(B, 9)

    # Capture intermediate shapes without modifying the model.
    captured = {}

    def make_hook(name):
        def hook(module, inp, out):
            captured[name] = out
        return hook

    model.aso_proj.register_forward_hook(make_hook("aso_proj"))
    model.target_proj.register_forward_hook(make_hook("target_proj"))
    model.cross_attention.register_forward_hook(make_hook("cross_attention"))

    model.train()
    prediction, attn_weights = model(aso_tokens, target_tokens, accessibility, handcrafted)

    aso = captured["aso_proj"]
    target = captured["target_proj"]
    cross_out, cross_w = captured["cross_attention"]
    final = model.head[0].in_features

    print("=== Synthetic verification ===")
    print(f"ASO projected           : {tuple(aso.shape)}   (expected (B, 19, 256))")
    print(f"Target projected        : {tuple(target.shape)}   (expected (B, 57, 256))")
    print(f"Cross-attention output  : {tuple(cross_out.shape)}   (expected (B, 19, 256))")
    print(f"Attention weights       : {tuple(attn_weights.shape)}   (expected (B, 19, 57))")
    print(f"Head input (concat)     : {final}  (expected 276 = 256 + 11 + 9)")
    print(f"Prediction              : {tuple(prediction.shape)}   (expected (B,))")

    assert tuple(aso.shape) == (B, 19, 256)
    assert tuple(target.shape) == (B, 57, 256)
    assert tuple(cross_out.shape) == (B, 19, 256)
    assert tuple(attn_weights.shape) == (B, 19, 57)
    assert final == 276
    assert tuple(prediction.shape) == (B,)

    # Gradient flow: every parameter must receive a gradient.
    loss = prediction.mean()
    loss.backward()
    missing = [
        name for name, p in model.named_parameters() if p.grad is None
    ]
    print(f"Gradients received      : {sum(1 for _, p in model.named_parameters() if p.grad is not None)}/"
          f"{sum(1 for _ in model.named_parameters())} parameters")
    assert not missing, f"no gradient for: {missing}"

    # Attention rows should be normalized in eval mode (dropout off).
    model.eval()
    with torch.no_grad():
        _, attn_eval = model(aso_tokens, target_tokens, accessibility, handcrafted)
    row_sums = attn_eval.sum(dim=2)
    print(f"Eval attention row sums : max deviation = "
          f"{(row_sums - 1.0).abs().max().item():.2e}")
    assert torch.allclose(row_sums, torch.ones_like(row_sums), atol=1e-4)
    assert model.last_attention is not None
    print("Gradient + eval-attention checks: OK\n")
    return model


def verify_on_real_data(batch=8):
    """Verify on real samples from the token cache."""
    from backend.datasets.huesken import HueskenDataset
    from backend.datasets.token_dataset import TokenDataset

    ds = TokenDataset(HueskenDataset("OligoFormer/data/Hu.csv"))
    print("=== Real-data verification ===")
    print(f"Dataset: {len(ds)} samples | aso_len={ds.aso_len} target_len={ds.target_len}")

    model = TokenCrossAttention(d_model=256, n_heads=8)
    model.eval()

    batch = min(batch, len(ds))
    samples = [ds[i] for i in range(batch)]
    aso_tokens = torch.stack([s["aso_tokens"] for s in samples])
    target_tokens = torch.stack([s["target_tokens"] for s in samples])
    accessibility = torch.stack([s["accessibility"] for s in samples])
    handcrafted = torch.stack([s["handcrafted"] for s in samples])
    labels = torch.stack([s["label"] for s in samples])

    print(f"aso_tokens      : {tuple(aso_tokens.shape)}")
    print(f"target_tokens   : {tuple(target_tokens.shape)}")
    print(f"accessibility   : {tuple(accessibility.shape)}")
    print(f"handcrafted     : {tuple(handcrafted.shape)}")
    print(f"labels          : {tuple(labels.shape)}")

    with torch.no_grad():
        prediction, attn_weights = model(
            aso_tokens, target_tokens, accessibility, handcrafted
        )

    print(f"prediction      : {tuple(prediction.shape)}")
    print(f"attention       : {tuple(attn_weights.shape)}")
    print(f"last_attention  : {tuple(model.last_attention.shape)}")

    assert tuple(prediction.shape) == (batch,)
    assert tuple(attn_weights.shape) == (batch, 19, 57)
    assert model.last_attention.shape == attn_weights.shape

    # Binding-site focus sanity check (eval mode, real data): attention on the
    # central target region (positions 19-37) should be comparable or higher
    # than the flanks (not a correctness assertion — just a printed summary).
    site = attn_weights[:, :, 19:38].mean()
    up = attn_weights[:, :, :19].mean()
    down = attn_weights[:, :, 38:].mean()
    print(f"attn binding-site {site:.4f} | upstream {up:.4f} | downstream {down:.4f}")
    print("Real-data verification: OK\n")


def main():
    verify_on_synthetic()
    verify_on_real_data()
    print("ALL CHECKS PASSED.")


if __name__ == "__main__":
    main()
