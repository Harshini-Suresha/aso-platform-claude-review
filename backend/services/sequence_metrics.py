"""
Shared, deterministic sequence-level metrics used across the product backend.

GC content was independently reimplemented in admet_service.py,
upload_service.py, and enrichment_service.py — three copies with no shared
source of truth, flagged in PROJECT_HANDOFF.md §7 ("cross-agent drift
warning") as exactly the kind of duplication that has silently diverged
before on this project. This module is the single real (Computed, not
Heuristic) implementation; the per-file wrappers exist only so each file's
existing private call sites don't need to change.
"""

from __future__ import annotations


def gc_content(seq: str) -> float:
    """GC content as a percentage (0-100), rounded to one decimal place.

    Case-insensitive; counts G/C only, so it applies identically to DNA (T)
    and RNA (U) sequences.
    """
    if not seq:
        return 0.0
    seq = seq.upper()
    gc = seq.count("G") + seq.count("C")
    return round((gc / len(seq)) * 100, 1)
