"""Combined results summary across all experiments.

Reads metrics from exp06_ablation, exp07_baselines, and exp08_shap,
and produces a unified results table for the paper.
"""

import os
import json
import yaml

EXP_DIR = "backend/experiments"


def load_json(path):
    with open(path) as f:
        return json.load(f)


def main():
    results = {}

    # --- Ablation results ---
    ablation_path = os.path.join(EXP_DIR, "exp06_ablation", "full_results.json")
    if os.path.exists(ablation_path):
        ablation = load_json(ablation_path)
        for exp in ablation:
            results[exp["experiment"]] = {
                "description": exp["description"],
                "input_dim": exp["input_dim"],
                "pearson_mean": exp["pearson_mean"],
                "pearson_sd": exp["pearson_sd"],
                "r2_mean": exp["r2_mean"],
                "r2_sd": exp["r2_sd"],
                "source": "ablation_study",
            }

    # --- Baseline results ---
    baseline_path = os.path.join(EXP_DIR, "exp07_baselines", "metrics.json")
    if os.path.exists(baseline_path):
        baselines = load_json(baseline_path)
        for name, res in baselines.items():
            results[f"baseline_{name}"] = {
                "description": f"Baseline: {name}",
                "input_dim": res["input_dim"],
                "pearson_mean": res["pearson_mean"],
                "pearson_sd": res["pearson_sd"],
                "r2_mean": res["r2_mean"],
                "r2_sd": res["r2_sd"],
                "source": "baseline_comparison",
            }

    # --- SHAP results ---
    shap_path = os.path.join(EXP_DIR, "exp08_shap", "family_importance.json")
    if os.path.exists(shap_path):
        fam = load_json(shap_path)
        print("\nSHAP Family Importance (FusionNet):")
        for k, v in fam.get("normalized", {}).items():
            print(f"  {k:20s}: {v*100:.1f}%")

    # --- Feature Attention results ---
    fa_path = os.path.join(EXP_DIR, "exp09_feature_attention", "comparison.json")
    fa_results = {}
    if os.path.exists(fa_path):
        fa_results = load_json(fa_path)

    # --- Print unified table ---
    print(f"\n{'='*95}")
    print(f"UNIFIED RESULTS TABLE — ASO Efficacy Prediction")
    print(f"{'='*95}")
    print(f"{'Model':<35} {'Input':>6} {'Pearson':>14} {'R²':>14} {'Source':>25}")
    print(f"{'-'*35} {'-'*6} {'-'*14} {'-'*14} {'-'*25}")

    # Sort: ablation experiments first, then baselines
    ablation_order = [
        "exp01_handcrafted",
        "exp02_rnafm",
        "exp03_accessibility",
        "exp04_rnafm_accessibility",
        "exp05_rnafm_handcrafted",
        "exp06_fusion",
    ]

    for key in ablation_order:
        if key in results:
            r = results[key]
            desc = r["description"][:33]
            print(f"{desc:<35} {r['input_dim']:>6} "
                  f"{r['pearson_mean']:>7.4f} ± {r['pearson_sd']:<4.4f}  "
                  f"{r['r2_mean']:>7.4f} ± {r['r2_sd']:<4.4f}  "
                  f"{r['source']:>25}")

    print(f"{'-'*35} {'-'*6} {'-'*14} {'-'*14} {'-'*25}")

    baseline_keys = [k for k in results if k.startswith("baseline_")]
    for key in baseline_keys:
        r = results[key]
        desc = r["description"][:33]
        print(f"{desc:<35} {r['input_dim']:>6} "
              f"{r['pearson_mean']:>7.4f} ± {r['pearson_sd']:<4.4f}  "
              f"{r['r2_mean']:>7.4f} ± {r['r2_sd']:<4.4f}  "
              f"{r['source']:>25}")

    if fa_results:
        print(f"{'-'*35} {'-'*6} {'-'*14} {'-'*14} {'-'*25}")
        for model_name in ["fusion", "gated"]:
            if model_name in fa_results:
                r = fa_results[model_name]
                label = "FusionNet" if model_name == "fusion" else "GatedFusionNet"
                input_dim = 1300
                print(f"{label:<35} {input_dim:>6} "
                      f"{r['pearson_mean']:>7.4f} ± {r['pearson_sd']:<4.4f}  "
                      f"{r['r2_mean']:>7.4f} ± {r['r2_sd']:<4.4f}  "
                      f"{'feature_attention':>25}")

    print()

    # --- Write unified markdown ---
    md = """# ASO Efficacy Prediction — Unified Results

## 1. Ablation Study (5-fold CV)

| Feature Configuration | Pearson | R² |
|----------------------|---------|-----|
"""

    for key in ablation_order:
        if key in results:
            r = results[key]
            md += f"| {r['description']} | {r['pearson_mean']:.4f} ± {r['pearson_sd']:.4f} | {r['r2_mean']:.4f} ± {r['r2_sd']:.4f} |\n"

    md += """
## 2. Baseline Comparison (5-fold CV, 1300-dim features)

| Model | Pearson | R² |
|-------|---------|-----|
"""
    for key in baseline_keys:
        r = results[key]
        md += f"| {r['description']} | {r['pearson_mean']:.4f} ± {r['pearson_sd']:.4f} | {r['r2_mean']:.4f} ± {r['r2_sd']:.4f} |\n"

    md += """
## 3. SHAP Feature Importance

| Feature Family | Importance (sum |SHAP|) | Normalized |
|----------------|---------------------|------------|
"""
    if os.path.exists(shap_path):
         fam = load_json(shap_path)
         for k, v in sorted(fam["normalized"].items(), key=lambda x: -x[1]):
             md += f"| {k} | {fam['raw'][k]:.4f} | {v*100:.1f}% |\n"

    md += """
## 4. Feature Attention (Gated Fusion)

| Model | Pearson | R² | ΔPearson | ΔR² |
|-------|---------|-----|----------|-----|
"""
    if fa_results:
        f = fa_results.get("fusion", {})
        g = fa_results.get("gated", {})
        if f and g:
            delta_p = g["pearson_mean"] - f["pearson_mean"]
            delta_r2 = g["r2_mean"] - f["r2_mean"]
            md += f"| FusionNet | {f['pearson_mean']:.4f} ± {f['pearson_sd']:.4f} | {f['r2_mean']:.4f} ± {f['r2_sd']:.4f} | — | — |\n"
            md += f"| GatedFusionNet | {g['pearson_mean']:.4f} ± {g['pearson_sd']:.4f} | {g['r2_mean']:.4f} ± {g['r2_sd']:.4f} | **{delta_p:+.4f}** | **{delta_r2:+.4f}** |\n"

            gates = g.get("avg_gate_weights", {})
            md += "\n### GatedFusionNet Gate Weights\n\n"
            md += "| Feature Family | Gate Weight | Normalized |\n"
            md += "|---------------|-------------|------------|\n"
            total_gates = sum(gates.values()) if gates else 1
            for fam, val in sorted(gates.items(), key=lambda x: -x[1]):
                md += f"| {fam} | {val:.4f} | {val/total_gates*100:.1f}% |\n"

    with open(os.path.join(EXP_DIR, "exp06_ablation", "unified_results.md"), "w") as f:
        f.write(md)

    print(f"\nUnified results saved to {EXP_DIR}/exp06_ablation/unified_results.md")


if __name__ == "__main__":
    main()
