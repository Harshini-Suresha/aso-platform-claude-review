"""ASO Atlas cleaning + weak-supervision rank labels.

Pipeline:
1. Load the ASO Atlas pickle (needs the repo's ``src`` package importable).
2. By default keep RNase H gapmers only (drop steric_blocking). With
   ``keep_steric`` keep BOTH: gapmers tagged ``mechanism=rnase_h`` and
   steric-blocking (splice-switching) rows tagged ``mechanism=
   splice_switching`` — the cross-mechanism axis of the paper.
3. Drop rows with missing efficacy or gene.
4. Normalize cell-line naming (e.g. "A-431" vs "A431").
5. Clip inhibition_percent to [0, 100] (raw values are noisy patent labels,
   observed range -786..+224).
6. Keep patent tables (``custom_id``) with >= MIN_TABLE_ROWS rows so that
   within-table ranks are statistically meaningful.
7. Dedup on (sequence, chemistry, gene) keeping the row from the largest
   table — each example belongs to exactly one experiment table.
8. Add ``rank_label``: percentile rank of efficacy within each table (0-100).
   Absolute patent labels are noisy; the within-experiment rank is the
   robust weak-supervision signal.
9. Write a clean parquet + stats JSON.

CLI:
    python -m backend.data_curation.aso_atlas --input <pkl> --output <dir>
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

MIN_TABLE_ROWS = 10

# Cell-line naming inconsistencies observed in ASO Atlas.
CELL_LINE_ALIASES = {
    "A-431": "A431",
}


def chemistry_fingerprint(chemistry) -> str:
    """Deterministic string fingerprint of a Chemistry object.

    ``chemistry`` is a pydantic ``Chemistry`` (length + list of
    Modification(modification, type, positions)).
    """
    try:
        length = int(getattr(chemistry, "length", None) or 0)
        mods = []
        for m in chemistry.modifications:
            pos = ",".join(str(int(p)) for p in m.positions)
            mods.append(f"{m.modification}|{m.type}|{pos}")
        mods.sort()
        return f"L{length} " + " ".join(mods)
    except Exception as exc:  # pragma: no cover - defensive
        raise ValueError(f"could not fingerprint chemistry: {chemistry!r}") from exc


def load_asoatlas(pkl_path: Path) -> pd.DataFrame:
    """Load the ASO Atlas pickle, importing the repo's ``src`` if needed."""
    repo_root = pkl_path.parent.parent
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    try:
        return pd.read_pickle(pkl_path)
    except ModuleNotFoundError:
        # Older pandas may need the compat module importable; retry once.
        import src.formats  # noqa: F401

        return pd.read_pickle(pkl_path)


def clean(df: pd.DataFrame, keep_steric: bool = False) -> pd.DataFrame:
    """Return the cleaned + rank-labeled DataFrame.

    With ``keep_steric``, steric-blocking rows are kept and tagged
    ``mechanism=splice_switching`` instead of being dropped; gapmers are
    tagged ``mechanism=rnase_h``.
    """
    keep = df.copy()

    if keep_steric:
        keep["mechanism"] = np.where(keep["steric_blocking"],
                                     "splice_switching", "rnase_h")
    else:
        keep = keep[keep["steric_blocking"] == False]  # noqa: E712
        keep["mechanism"] = "rnase_h"
    keep = keep[keep["inhibition_percent"].notna()]
    keep = keep[keep["target_gene"].notna()]
    keep = keep[keep["custom_id"].notna()]
    keep = keep[keep["chemistry"].notna()]

    keep["cell_line"] = keep["cell_line"].map(
        lambda c: CELL_LINE_ALIASES.get(c, c)
    )
    keep["inhibition_percent"] = keep["inhibition_percent"].clip(0.0, 100.0)
    keep["chemistry_fingerprint"] = keep["chemistry"].map(chemistry_fingerprint)
    keep["aseq"] = keep["aso_sequence_5_to_3"].str.upper().str.replace("T", "U", regex=False)

    # Drop object columns that pyarrow cannot serialize (pydantic models).
    keep = keep.drop(columns=["chemistry"])

    # Keep tables large enough for meaningful within-table ranks.
    table_sizes = keep.groupby("custom_id")["aseq"].transform("size")
    keep = keep[table_sizes >= MIN_TABLE_ROWS].copy()

    # Dedup (seq, chem, gene): keep the row from the largest table.
    table_size = keep.groupby("custom_id")["aseq"].transform("size")
    keep["_table_size"] = table_size
    dedup_key = ["aseq", "chemistry_fingerprint", "target_gene"]
    keep = keep.sort_values("_table_size", ascending=False).drop_duplicates(
        subset=dedup_key, keep="first"
    )
    keep = keep.drop(columns="_table_size")

    # Within-table percentile rank (0-100). Tables were pre-filtered to >=
    # MIN_TABLE_ROWS so these are stable.
    keep["rank_label"] = (
        keep.groupby("custom_id")["inhibition_percent"]
        .rank(pct=True)
        .mul(100.0)
    )

    return keep.reset_index(drop=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--keep_steric", action="store_true",
                        help="keep splice-switching (steric-blocking) rows "
                             "tagged mechanism=splice_switching")
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    df = load_asoatlas(args.input)
    cleaned = clean(df, keep_steric=args.keep_steric)

    out_pq = args.output / "aso_atlas_clean.parquet"
    cleaned.to_parquet(out_pq, index=False)

    stats = {
        "raw_rows": int(len(df)),
        "cleaned_rows": int(len(cleaned)),
        "mechanism": cleaned["mechanism"].value_counts().to_dict(),
        "genes": int(cleaned["target_gene"].nunique()),
        "patent_tables": int(cleaned["custom_id"].nunique()),
        "chemistry_fingerprints": int(cleaned["chemistry_fingerprint"].nunique()),
        "label_range_raw": [float(df["inhibition_percent"].min()), float(df["inhibition_percent"].max())],
        "label_mean": float(cleaned["inhibition_percent"].mean()),
        "rank_label_mean": float(cleaned["rank_label"].mean()),
    }
    stats_path = args.output / "aso_atlas_stats.json"
    stats_path.write_text(json.dumps(stats, indent=2))

    print(f"wrote {out_pq} ({len(cleaned)} rows)")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
