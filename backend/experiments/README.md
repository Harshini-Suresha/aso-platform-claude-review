# Experiments Registry

This directory contains all ML experiments for the ASO platform, organized by experiment ID.

## Directory Structure

```
backend/experiments/
├── cv_fusion.py              # Original 5-fold CV training (Pearson = 0.551)
├── hyperparameter_search.py   # Grid search over 243 configs (best: Pearson = 0.560)
├── ablation_study.py         # Ablation study: 6 experiments, 5-fold CV
├── baseline_comparison.py    # Classical ML baselines vs FusionNet
├── shap_explainability.py    # SHAP explainability analysis
├── feature_attention.py      # Gated Fusion with per-family attention
├── cross_attention.py        # Cross-feature interaction (exp10)
├── token_cross_attention.py  # Token-level cross-attention transformer (exp11)
├── combined_results.py       # Unified results table generator
├── cv_results.txt            # CV results from original FusionNet
├── cv_analysis.md            # Analysis of CV results
├── README.md                 # This file
├── exp06_ablation/           # Ablation study outputs
│   ├── config.yaml
│   ├── metrics.json
│   ├── training_curve.json
│   ├── training_curve.png
│   ├── ablation_table.md
│   ├── ablation_results.json
│   ├── full_results.json
│   ├── unified_results.md
│   ├── exp01_handcrafted/
│   ├── exp02_rnafm/
│   ├── exp03_accessibility/
│   ├── exp04_rnafm_accessibility/
│   ├── exp05_rnafm_handcrafted/
│   └── exp06_fusion/
├── exp07_baselines/          # Baseline comparison outputs
│   ├── config.yaml
│   ├── metrics.json
│   └── baseline_table.md
├── exp08_shap/               # SHAP analysis outputs
│   ├── best_model.pt
│   ├── metrics.json
│   ├── family_importance.json
│   ├── shap_summary_by_family.png
│   ├── shap_family_importance.png
│   ├── shap_feature_importance.png
│   └── force_plots/
└── exp09_feature_attention/  # Feature attention (gated fusion) outputs
    ├── comparison.json
    ├── comparison_table.md
    ├── fusion/
    │   ├── config.yaml
    │   ├── metrics.json
    │   ├── training_curve.json
    │   ├── training_curve.png
    │   └── best_model.pt
    └── gated/
        ├── config.yaml
        ├── metrics.json
        ├── training_curve.json
        ├── training_curve.png
        └── best_model.pt
└── exp10_cross_attention/    # Cross-feature interaction outputs
    ├── config.yaml
    ├── metrics.json
    ├── training_curve.json
    ├── training_curve.png
    ├── cross_attention_heatmap.png
    └── comparison.json
└── exp11_token_cross_attention/  # Token-level cross-attention outputs
    ├── config.yaml
    ├── metrics.json
    ├── training_curve.json
    ├── training_curve.png
    ├── aso_x_target_attention.png
    └── comparison.json
```

## Experiment Summaries

### Ablation Study (exp06)

| Model | Pearson | R² |
|-------|---------|-----|
| Handcrafted features only (9-dim) | 0.2967 ± 0.0512 | 0.0855 ± 0.0301 |
| RNA-FM embeddings only (1280-dim) | **0.5641 ± 0.0097** | **0.2892 ± 0.0158** |
| Accessibility features only (11-dim) | 0.1189 ± 0.0609 | 0.0098 ± 0.0150 |
| RNA-FM + Accessibility (1291-dim) | 0.5370 ± 0.0388 | 0.2764 ± 0.0509 |
| RNA-FM + Handcrafted (1289-dim) | 0.5507 ± 0.0248 | 0.2885 ± 0.0275 |
| Full FusionNet (1300-dim) | 0.5520 ± 0.0183 | 0.2735 ± 0.0307 |

**Key finding:** RNA-FM embeddings alone (Pearson=0.564) outperform the full FusionNet. The handcrafted and accessibility features add marginal/no value through simple concatenation + MLP.

### Baseline Comparison (exp07)

| Model | Pearson | R² | MSE | MAE |
|-------|---------|-----|-----|-----|
| RandomForest | 0.4312 ± 0.0422 | 0.1663 | 0.0187 | 0.1100 |
| XGBoost | 0.4709 ± 0.0490 | 0.2174 | 0.0176 | 0.1053 |
| SVR (RBF) | 0.5404 ± 0.0317 | 0.2841 | 0.0161 | 0.1002 |
| **FusionNet** | **0.5520 ± 0.0183** | 0.2735 | 0.0163 | 0.0996 |

**Key finding:** FusionNet wins on Pearson (0.552 vs 0.540 for SVR) with the lowest fold-to-fold variance (±0.018).

### SHAP Explainability (exp08)

| Feature Family | Importance (sum \|SHAP\|) | Normalized |
|----------------|------|------------|
| rnafm_mRNA | 2.9038 | 50.5% |
| rnafm_siRNA | 2.8041 | 48.7% |
| handcrafted | 0.0278 | 0.5% |
| accessibility | 0.0192 | 0.3% |

**Key finding:** RNA-FM embeddings account for ~99% of model explainability in the plain MLP. Biological features are effectively ignored.

### Feature Attention — Gated Fusion (exp09)

| Model | Pearson | R² | ΔPearson | ΔR² |
|-------|---------|-----|----------|-----|
| FusionNet | 0.5520 ± 0.0183 | 0.2735 ± 0.0307 | — | — |
| **GatedFusionNet** | **0.5848 ± 0.0223** | **0.3309 ± 0.0288** | **+0.0329** | **+0.0574** |

**GatedFusionNet gate weights (learned per-family attention):**

| Feature Family | Gate Weight | Normalized |
|---------------|-------------|------------|
| rnafm_siRNA | 0.614 | 31.1% |
| rnafm_mRNA | 0.550 | 27.8% |
| accessibility | 0.427 | 21.6% |
| handcrafted | 0.385 | 19.5% |

**Key finding:** GatedFusionNet improves Pearson by +0.033 and R² by +0.057 over plain FusionNet. The attention mechanism enables the model to meaningfully utilize handcrafted and accessibility features (20-22% gate weight) that were ignored by simple concatenation.

### Cross-Feature Interaction (exp10)

NOTE: RNA-FM embeddings are mean-pooled to one 640-dim vector per sequence, so nucleotide-level cross-attention is not possible with cached features. `CrossAttentionFusion` implements the fallback: feature-level cross-attention (query=ASO, key/value=target) + elementwise bilinear interaction + gated biological features.

| Model | Pearson | R² |
|-------|---------|-----|
| RNA-FM only | 0.5641 ± 0.0097 | 0.2892 ± 0.0158 |
| FusionNet | 0.5520 ± 0.0183 | 0.2735 ± 0.0307 |
| GatedFusionNet | 0.5848 ± 0.0223 | 0.3309 ± 0.0288 |
| CrossAttentionFusion | 0.5843 ± 0.0244 | 0.3261 ± 0.0283 |

**Key finding:** CrossAttentionFusion is statistically tied with GatedFusionNet and above FusionNet / RNA-FM-only. Interaction terms add no signal beyond gating when embeddings are pooled — remaining signal likely lives at the nucleotide level, motivating token-level re-embedding.

### Token-Level Cross-Attention Transformer (exp11)

Phase 11 model. Instead of one mean-pooled 640-dim vector per sequence, this consumes **per-nucleotide RNA-FM token embeddings** (`backend/data/hu_token_embeddings.pt`): ASO `(N, 19, 640)`, target `(N, 57, 640)`. Huesken targets are pre-windowed (19 nt upstream + 19 nt binding site + 19 nt downstream), so lengths are fixed → no padding/masking. Architecture: per-token projection + learnable positional encoding → target self-attention (1 block) → ASO-position cross-attention over target positions → mean-pool + bilinear + gated bio features → MLP head. Protocol identical to prior experiments.

| Model | Pearson | R² |
|-------|---------|-----|
| RNA-FM only | 0.5641 ± 0.0097 | 0.2892 ± 0.0158 |
| FusionNet | 0.5520 ± 0.0183 | 0.2735 ± 0.0307 |
| GatedFusionNet | 0.5848 ± 0.0223 | 0.3309 ± 0.0288 |
| CrossAttentionFusion (feat-level) | 0.5843 ± 0.0244 | 0.3261 ± 0.0283 |
| **TokenCrossAttention (nt-level)** | **0.6195 ± 0.0264** | **0.3720 ± 0.0411** |

**Key finding:** Nucleotide-level cross-attention raises Pearson to **0.6195** (+0.035 vs GatedFusionNet, +0.035 vs CrossAttentionFusion) and R² to 0.372. The ASO-position × target-position attention matrix shows the highest weight on the **binding-site region** (target positions 19–37): mean attention 0.0195 vs 0.0168 upstream / 0.0164 downstream. Paired t-test across the 5 folds vs exp10 gives p=0.067 — trending but not significant at α=0.05 with this sample of folds; the direction is consistent (best Pearson in 4 of 5 folds).

## Reproducibility

All experiments use:
- Dataset: `OligoFormer/data/Hu.csv` (2,361 ASO-mRNA pairs)
- Embedding cache: `backend/data/hu_embeddings.pt`
- Seed: 42
- 5-fold cross-validation (KFold, shuffle=True)
- Best hyperparameters from HPO: lr=1e-3, dropout=0.2, weight_decay=1e-5, batch=32

### Running Experiments

```bash
# Ablation study
python backend/experiments/ablation_study.py

# Baseline comparison
python backend/experiments/baseline_comparison.py

# SHAP explainability
python backend/experiments/shap_explainability.py

# Feature attention (gated fusion)
python backend/experiments/feature_attention.py

# Cross-feature interaction (exp10)
python backend/experiments/cross_attention.py

# Token-level cross-attention (exp11)
python backend/experiments/token_cross_attention.py

# Combined results summary
python backend/experiments/combined_results.py
```
