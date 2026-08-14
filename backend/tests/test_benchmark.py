import numpy as np
import pandas as pd
import pytest

from backend.experiments.benchmark.generative_design import gc_mean
from backend.experiments.benchmark.invariant_ranker import (
    _wilson_interval,
    conformal_topk,
)


def test_gc_mean_mechanism_and_oov_fallback():
    df = pd.DataFrame({
        "modality": ["rnase_h"] * 3 + ["sirna"] * 2,
        "seq": ["GC", "AU", "GU", "AU", "GC"],
    })
    assert gc_mean(df, "rnase_h") == pytest.approx(0.5)
    assert gc_mean(df, "sirna") == pytest.approx(0.5)
    assert gc_mean(df, "sirna") == gc_mean(df, "rnase_h")
    oov = gc_mean(df, "does_not_exist")
    assert oov == pytest.approx(0.5)


def test_wilson_interval_zero_hits():
    lo, hi = _wilson_interval(0, 6)
    assert lo == 0.0
    assert 0.0 < hi < 0.5


def test_conformal_topk_reports_ci():
    rng = np.random.default_rng(0)
    n_groups = 12
    group_scores = {e: rng.normal(size=20) for e in range(n_groups)}
    group_true = {e: np.zeros(20, dtype=bool) for e in range(n_groups)}
    for e in range(n_groups):
        group_true[e][np.argsort(group_scores[e])[-2:]] = True
    group_sizes = {e: 20 for e in range(n_groups)}
    res = conformal_topk(group_scores, group_true, group_sizes, k=2)
    assert "coverage_ci" in res and len(res["coverage_ci"]) == 2
    assert "selected_size_mean_ci" in res
    assert "selected_size_median_ci" in res
    assert res["n_groups"] == n_groups // 2
    assert res["coverage_ci"][0] <= res["coverage"] <= res["coverage_ci"][1]
