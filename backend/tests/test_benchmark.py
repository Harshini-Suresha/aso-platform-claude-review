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


def _synth(n_groups, size=20, k=2, seed=0):
    rng = np.random.default_rng(seed)
    scores = {e: rng.normal(size=size) for e in range(n_groups)}
    true = {e: np.zeros(size, dtype=bool) for e in range(n_groups)}
    for e in range(n_groups):
        true[e][np.argsort(scores[e])[-k:]] = True
    sizes = {e: size for e in range(n_groups)}
    return scores, true, sizes


def test_conformal_topk_refuses_when_too_few_calibration_groups():
    """12 groups gives 6 calibration groups. At alpha=0.1 a non-trivial
    threshold needs at least 1/alpha - 1 = 9, so no guarantee exists.

    Reporting a coverage number here would look like a guarantee and not be
    one, which is worse than reporting nothing.
    """
    res = conformal_topk(*_synth(12), k=2)
    assert res["guarantee"] == "unavailable"
    assert "9" in res["guarantee_reason"]
    assert "coverage_ci" not in res


def test_conformal_topk_reports_ci_when_adequately_powered():
    res = conformal_topk(*_synth(60), k=2)
    assert res["guarantee"] in ("valid", "underpowered")
    assert "coverage_ci" in res and len(res["coverage_ci"]) == 2
    assert "selected_size_mean_ci" in res
    assert "selected_size_median_ci" in res
    assert res["n_groups"] == 30
    assert res["coverage_ci"][0] <= res["coverage"] <= res["coverage_ci"][1]


def test_conformal_quantile_index_uses_floor_not_ceil():
    """The guarantee needs the FLOOR(alpha*(n_cal+1))-th smallest tau.

    With n_cal calibration taus exchangeable with the test tau, the test
    tau's rank among all n_cal+1 is uniform, so coverage = 1 - m/(n_cal+1)
    for the m-th smallest threshold. Achieving 1-alpha needs
    m <= alpha*(n_cal+1) — the largest such integer, i.e. the floor.

    Taking the ceil overshoots by one whenever alpha*(n_cal+1) is not an
    integer and drops coverage below nominal: at n_cal=30, alpha=0.1 it
    yields 1 - 4/31 = 0.871 against a target of 0.90. This asserts the
    achieved coverage clears nominal.
    """
    alpha = 0.10
    n_groups = 60
    n_cal = n_groups // 2
    covs = []
    for seed in range(120):
        res = conformal_topk(*_synth(n_groups, seed=seed), k=2, alpha=alpha)
        covs.append(res["coverage"])
    empirical = float(np.mean(covs))
    expected = 1.0 - np.floor(alpha * (n_cal + 1)) / (n_cal + 1)
    assert expected >= 1 - alpha, "floor index must clear nominal in theory"
    # Allow sampling slack, but the ceil variant (0.871) must be excluded.
    assert empirical > 0.88, f"coverage {empirical:.3f} is below nominal"
