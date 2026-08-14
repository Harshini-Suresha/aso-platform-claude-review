# ASO Efficacy Prediction — Unified Results

## 1. Ablation Study (5-fold CV)

| Feature Configuration | Pearson | R² |
|----------------------|---------|-----|
| Handcrafted features only (9-dim) | 0.2967 ± 0.0512 | 0.0855 ± 0.0301 |
| RNA-FM embeddings only (1280-dim) | 0.5641 ± 0.0097 | 0.2892 ± 0.0158 |
| Accessibility features only (11-dim) | 0.1189 ± 0.0609 | 0.0098 ± 0.0150 |
| RNA-FM + Accessibility (1291-dim) | 0.5370 ± 0.0388 | 0.2764 ± 0.0509 |
| RNA-FM + Handcrafted (1289-dim) | 0.5507 ± 0.0248 | 0.2885 ± 0.0275 |
| Full FusionNet (1300-dim) | 0.5520 ± 0.0183 | 0.2735 ± 0.0307 |

## 2. Baseline Comparison (5-fold CV, 1300-dim features)

| Model | Pearson | R² |
|-------|---------|-----|
| Baseline: RandomForest | 0.4312 ± 0.0422 | 0.1663 ± 0.0266 |
| Baseline: XGBoost | 0.4709 ± 0.0490 | 0.2174 ± 0.0500 |
| Baseline: SVR_rbf | 0.5404 ± 0.0317 | 0.2841 ± 0.0329 |
| Baseline: FusionNet | 0.5520 ± 0.0183 | 0.2735 ± 0.0307 |

## 3. SHAP Feature Importance

| Feature Family | Importance (sum |SHAP|) | Normalized |
|----------------|---------------------|------------|
| rnafm_mRNA | 2.9038 | 50.5% |
| rnafm_siRNA | 2.8041 | 48.7% |
| handcrafted | 0.0278 | 0.5% |
| accessibility | 0.0192 | 0.3% |

## 4. Feature Attention (Gated Fusion)

| Model | Pearson | R² | ΔPearson | ΔR² |
|-------|---------|-----|----------|-----|
| FusionNet | 0.5520 ± 0.0183 | 0.2735 ± 0.0307 | — | — |
| GatedFusionNet | 0.5848 ± 0.0223 | 0.3309 ± 0.0288 | **+0.0329** | **+0.0574** |

### GatedFusionNet Gate Weights

| Feature Family | Gate Weight | Normalized |
|---------------|-------------|------------|
| rnafm_siRNA | 0.6140 | 31.1% |
| rnafm_mRNA | 0.5502 | 27.8% |
| accessibility | 0.4272 | 21.6% |
| handcrafted | 0.3850 | 19.5% |
