"""Unified cross-modality benchmark ingestion.

Merges two modalities into ONE schema so that a single sequence-activity
model can rank both:

  * gapmer ASO   : ASO Atlas (cleaned, RNase H gapmers, patent tables)
                   experiment group = patent table (``custom_id``)
  * siRNA        : siRBench (train/test/leftout, Huesken/Takayuki/...,
                   efficiency 0-1) experiment group = (source, cell_line)

Design rationale (the weak-supervision thesis):
  Absolute labels are NOT comparable across experiments: patent tables use
  different assays/cell lines/scales; siRBench sub-datasets use different
  readouts. The robust cross-experiment signal is the WITHIN-EXPERIMENT
  RANK. Every row therefore gets ``rank_label`` = percentile rank within
  its experiment group, and (for the regression baseline) ``label_z`` =
  within-experiment z-score.

Shared feature space: RNA sequence tokens (A/C/G/U) plus a chemistry
channel. siRNAs are treated as chemistry ``unmodified``. This is what makes
cross-chemistry (MOE vs cEt) and cross-modality (siRNA vs gapmer) transfer
experiments expressible in one model.

CLI:
    python -m backend.data_curation.unified --aso <clean.parquet> \
        --sirbench <dir> --output <dir>
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

MIN_EXPERIMENT_ROWS = 10


def _norm_seq(s: str) -> str:
    return s.upper().replace("T", "U").replace("_", "").replace(" ", "")


def _norm_cell(c: str) -> str:
    return str(c).lower().replace("-", "").replace(" ", "")


def load_aso(parquet_path: Path) -> pd.DataFrame:
    df = pd.read_parquet(parquet_path)
    if "mechanism" in df.columns:
        df["modality"] = df["mechanism"]
    else:
        df["modality"] = "gapmer"
    df["experiment_id"] = df["custom_id"].astype(str)
    df["target_gene"] = df["target_gene"]
    df["label"] = df["inhibition_percent"].astype(float)
    df["chemistry"] = df["chemistry_fingerprint"].astype(str)
    df["cell_line"] = df["cell_line"].map(_norm_cell)
    df["source"] = "aso_atlas"
    df["seq"] = df["aseq"].map(_norm_seq)
    return df[["seq", "modality", "experiment_id", "target_gene", "label",
               "chemistry", "cell_line", "source"]].copy()


def load_sirbench(dir_path: Path) -> pd.DataFrame:
    parts = []
    for name in ("siRBench_train", "siRBench_test", "siRBench_leftout"):
        p = dir_path / f"{name}.csv"
        if not p.exists():
            continue
        parts.append(pd.read_csv(p))
    d = pd.concat(parts, ignore_index=True)
    d = d.rename(columns={"siRNA": "seq", "mRNA": "target_gene",
                          "efficiency": "label"})
    d["seq"] = d["seq"].map(_norm_seq)
    d["modality"] = "sirna"
    d["cell_line"] = d["cell_line"].map(_norm_cell)
    d["source"] = d["source"].astype(str).str.lower()
    d["experiment_id"] = d["source"] + "|" + d["cell_line"]
    d["chemistry"] = "unmodified"
    d["label"] = d["label"].astype(float).mul(100.0)  # 0-1 -> 0-100
    return d[["seq", "modality", "experiment_id", "target_gene", "label",
              "chemistry", "cell_line", "source"]].copy()


def build(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["seq"] = df["seq"].map(_norm_seq)
    df["seq_len"] = df["seq"].str.len()
    df = df[df["seq"].str.contains("^[ACGU]+$", regex=True, na=False)]

    # Keep experiments large enough for meaningful within-experiment ranks.
    sizes = df.groupby("experiment_id")["seq"].transform("size")
    df = df[sizes >= MIN_EXPERIMENT_ROWS].copy()

    # Dedup (seq, modality): keep the row from the largest experiment group.
    df["_exp_size"] = df.groupby("experiment_id")["seq"].transform("size")
    df = df.sort_values("_exp_size", ascending=False).drop_duplicates(
        subset=["seq", "modality"], keep="first"
    )
    df = df.drop(columns="_exp_size")

    # Within-experiment weak-supervision targets.
    df["rank_label"] = df.groupby("experiment_id")["label"].rank(pct=True).mul(100.0)
    gz = df.groupby("experiment_id")["label"]
    df["label_z"] = (df["label"] - gz.transform("mean")) / gz.transform("std").replace(0.0, 1.0)

    df["is_train_source"] = df["source"] != "leftout"
    return df.reset_index(drop=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--aso", required=True, type=Path,
                        help="cleaned ASO Atlas parquet")
    parser.add_argument("--sirbench", required=True, type=Path,
                        help="dir with siRBench_*.csv")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    df = build(pd.concat([load_aso(args.aso), load_sirbench(args.sirbench)],
                         ignore_index=True))
    df.to_parquet(args.output / "unified_benchmark.parquet", index=False)

    stats = {
        "rows": int(len(df)),
        "modality": df["modality"].value_counts().to_dict(),
        "experiments": int(df["experiment_id"].nunique()),
        "chemistry_classes": int(df["chemistry"].nunique()),
        "target_genes": int(df["target_gene"].nunique()),
        "seq_len_range": [int(df["seq_len"].min()), int(df["seq_len"].max())],
        "label_corr_rank_raw": float(df.groupby("experiment_id").apply(
            lambda g: g["label"].corr(g["rank_label"]) if len(g) > 1 else 0.0
        ).mean()),
    }
    (args.output / "unified_benchmark_stats.json").write_text(
        json.dumps(stats, indent=2))
    print(f"wrote {args.output / 'unified_benchmark.parquet'} ({len(df)} rows)")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
