"""Accessibility features computed from RNA secondary structure
base-pairing probabilities (analogous to RNAplfold's unpaired
probability).

For each target site we compute:
  * mean unpaired probability over the guide-binding region
  * minimum unpaired probability over the guide-binding region
  * maximum unpaired probability over the guide-binding region
  * global mean unpaired probability (whole mRNA)
  * sliding-window accessibility (window=5, mean)
  * mean positional entropy
  * mean unpaired probability over the siRNA-length window

The siRNA binding site is located by searching for the reverse
complement of the siRNA within the (cleaned) mRNA sequence.
"""

import numpy as np

VALID_BASES = set("ACGTU")


def _clean_sequence(seq: str) -> str:
    """Remove non-RNA characters and normalize to uppercase RNA."""
    seq = seq.upper().replace("T", "U")
    return "".join(b for b in seq if b in VALID_BASES - {"T"})


def _reverse_complement(seq: str) -> str:
    """Reverse complement of an RNA sequence (siRNA binds complementarily)."""
    comp = {"A": "U", "U": "A", "C": "G", "G": "C"}
    return "".join(comp.get(b, "N") for b in reversed(seq.upper()))


def _find_binding_site(mrna: str, guide: str) -> int:
    """Find the best seed match position for the guide in the mRNA.

    Returns the 0-based start index of the binding site, or 0 if
    no reasonable match is found.
    """
    rc = _reverse_complement(guide)
    guide_len = len(guide)
    mrna_len = len(mrna)

    if mrna_len < guide_len:
        return 0

    best_pos = 0
    best_score = -1

    for i in range(mrna_len - guide_len + 1):
        window = mrna[i : i + guide_len]
        score = sum(1 for a, b in zip(rc, window) if a == b)
        if score > best_score:
            best_score = score
            best_pos = i

    # Only accept if at least half of positions match
    if best_score < guide_len // 2:
        return 0

    return best_pos


def _bpp_unpaired_probs(fc, n: int) -> np.ndarray:
    """Compute per-position unpaired probability from bpp matrix."""
    bpp = fc.bpp()
    bpp_matrix = np.array(bpp)
    paired_prob = bpp_matrix.sum(axis=1)
    unpaired = 1.0 - paired_prob
    # Drop the ViennaRNA dummy index 0
    return unpaired[1:]


def _sliding_window_mean(values: np.ndarray, window: int = 5) -> np.ndarray:
    """Compute sliding-window mean of a 1-D array."""
    if len(values) == 0:
        return np.array([0.0])
    n = len(values)
    window = min(window, n)
    cumsum = np.cumsum(np.insert(values, 0, 0))
    return (cumsum[window:] - cumsum[:-window]) / window


class AccessibilityFeatures:
    """Compute RNAplfold-style accessibility features for an siRNA–mRNA pair."""

    def __init__(self, window_size: int = 5):
        self.window_size = window_size

    @staticmethod
    def compute(mrna_sequence: str, aso_sequence: str) -> dict:
        mrna = _clean_sequence(mrna_sequence)
        guide = _clean_sequence(aso_sequence)
        n = len(mrna)

        if n == 0:
            return _zero_accessibility_features()

        import RNA

        fc = RNA.fold_compound(mrna)
        fc.pf()

        bpp = fc.bpp()
        bpp_matrix = np.array(bpp, dtype=float)
        paired_prob = bpp_matrix.sum(axis=1)
        unpaired = 1.0 - paired_prob
        unpaired = unpaired[1:]  # drop dummy index 0

        # Positional entropy
        entropy = fc.positional_entropy()
        entropy_arr = np.array(entropy, dtype=float)
        # entropy[0] is the sequence length (sanity check); actual starts at 1
        if len(entropy_arr) == n + 1:
            entropy_arr = entropy_arr[1:]
        elif len(entropy_arr) == n:
            pass

        # Binding site
        site_start = _find_binding_site(mrna, guide)
        guide_len = min(len(guide), n - site_start) if n > site_start else 1
        site_end = site_start + guide_len

        if site_end <= site_start:
            site_unpaired = unpaired
            site_entropy = entropy_arr
        else:
            site_unpaired = unpaired[site_start:site_end]
            site_entropy = entropy_arr[site_start:site_end]

        if len(site_unpaired) == 0:
            site_unpaired = np.array([0.0])
        if len(site_entropy) == 0:
            site_entropy = np.array([0.0])

        slide = _sliding_window_mean(unpaired, window=5)

        return {
            "accessibility_mean": float(np.mean(site_unpaired)),
            "accessibility_min": float(np.min(site_unpaired)),
            "accessibility_max": float(np.max(site_unpaired)),
            "accessibility_global_mean": float(np.mean(unpaired)),
            "accessibility_global_min": float(np.min(unpaired)),
            "accessibility_global_max": float(np.max(unpaired)),
            "sliding_window_mean": float(np.mean(slide)),
            "positional_entropy_mean": float(np.mean(site_entropy)),
            "positional_entropy_global_mean": float(np.mean(entropy_arr)),
            "binding_site_start": int(site_start),
            "binding_site_end": int(site_end),
        }


def _zero_accessibility_features() -> dict:
    return {
        "accessibility_mean": 0.0,
        "accessibility_min": 0.0,
        "accessibility_max": 0.0,
        "accessibility_global_mean": 0.0,
        "accessibility_global_min": 0.0,
        "accessibility_global_max": 0.0,
        "sliding_window_mean": 0.0,
        "positional_entropy_mean": 0.0,
        "positional_entropy_global_mean": 0.0,
        "binding_site_start": 0,
        "binding_site_end": 0,
    }
