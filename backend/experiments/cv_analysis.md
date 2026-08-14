# CV Analysis & Training Improvements

## Root Cause
The original CV used 10 hardcoded epochs (`range(10)` in `cv_fusion.py`), which was too short.
With proper training (100 epochs + early stopping), all 5 folds now reach Pearson 0.51–0.59.

## 5-Fold CV Results (after fix)

| Fold | Pearson | R²   | MSE   |
|------|---------|------|-------|
| 1    | 0.5887  | 0.33 | 0.0154|
| 2    | 0.5086  | 0.24 | 0.0167|
| 3    | 0.5483  | 0.28 | 0.0159|
| 4    | 0.5507  | 0.27 | 0.0164|
| 5    | 0.5592  | 0.29 | 0.0163|
| Mean | 0.5511  | 0.28 | -     |
| SD   | 0.0257  | 0.03 | -     |

## Bug Check
- Model reinitialized each fold: OK
- Optimizer reinitialized each fold: OK
- Embedding/label alignment: OK
- No StandardScaler (no normalization leak): OK
- Early stopping saves best model: OK
- No CV implementation bugs found

## Changes Made
| File | Change |
|------|--------|
| backend/config/config.yaml | epochs: 50→100, added patience: 10 |
| backend/train.py | Early stopping + best checkpoint + Pearson in output |
| backend/experiments/cv_fusion.py | Per-epoch val loss, early stopping, best checkpoint, Pearson |
