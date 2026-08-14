import torch

from backend.models.token_cross_attention import TokenCrossAttention


def _make_inputs(batch=4):
    aso_tokens = torch.randn(batch, 19, 640)
    target_tokens = torch.randn(batch, 57, 640)
    accessibility = torch.randn(batch, 11)
    handcrafted = torch.randn(batch, 9)
    return aso_tokens, target_tokens, accessibility, handcrafted


def test_forward_shapes():
    model = TokenCrossAttention()
    aso, target, acc, hc = _make_inputs()
    pred, attn = model(aso, target, acc, hc)

    assert tuple(pred.shape) == (4,)
    assert tuple(attn.shape) == (4, 19, 57)


def test_head_input_dim_is_276():
    assert TokenCrossAttention().head[0].in_features == 276


def test_gradient_flow():
    model = TokenCrossAttention()
    aso, target, acc, hc = _make_inputs()
    pred, _ = model(aso, target, acc, hc)
    pred.mean().backward()

    missing = [n for n, p in model.named_parameters() if p.grad is None]
    assert not missing


def test_attention_normalized_in_eval():
    model = TokenCrossAttention()
    model.eval()
    aso, target, acc, hc = _make_inputs()
    with torch.no_grad():
        _, attn = model(aso, target, acc, hc)
    assert torch.allclose(attn.sum(dim=2), torch.ones(4, 19), atol=1e-4)
    assert model.last_attention is not None


def test_attention_cached_during_eval():
    model = TokenCrossAttention()
    assert model.last_attention is None
    model.eval()
    aso, target, acc, hc = _make_inputs()
    with torch.no_grad():
        model(aso, target, acc, hc)
    assert model.last_attention.shape == (4, 19, 57)
