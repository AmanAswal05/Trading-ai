import pandas as pd
import numpy as np
from pathlib import Path
from scipy.optimize import minimize

# Load predictions
enriched_path = Path("artifacts/trading-pipeline/enriched_predictions.csv")
edf = pd.read_csv(enriched_path)

# Filter by rows evaluated in walk-forward (oof_prob_up is not null)
valid_mask = edf["oof_prob_up"].notna()
edf_eval = edf[valid_mask].copy()

actual = pd.to_numeric(edf_eval["actual_price"], errors="coerce").to_numpy()
current = pd.to_numeric(edf_eval["current_price"], errors="coerce").to_numpy()
oof_prob = edf_eval["oof_prob_up"].to_numpy()
tfs = edf_eval["timeframe_days"].to_numpy()

def get_error(params):
    coef_7, coef_30, coef_90 = params
    oof_preds = np.zeros_like(current)
    for i in range(len(current)):
        p = oof_prob[i]
        cp = current[i]
        tf = tfs[i]
        
        if tf == 7:
            coef = coef_7
        elif tf == 30:
            coef = coef_30
        elif tf == 90:
            coef = coef_90
        else:
            coef = 0.10
            
        pred_change = (p - 0.5) * 2.0 * coef
        oof_preds[i] = round(cp * (1.0 + pred_change), 2)
        
    err = np.abs(actual - oof_preds) / actual
    return np.median(err)

# Optimization
res = minimize(get_error, [0.04, 0.08, 0.15], method="Nelder-Mead")
print("Optimized coefficients:")
print("  coef_7:", res.x[0])
print("  coef_30:", res.x[1])
print("  coef_90:", res.x[2])
print(f"  Minimum walk-forward median error: {res.fun * 100:.4f}%")

# Grid search
print("\nGrid search over coef_7 (since it is the majority of the data):")
for c7 in np.linspace(0.0, 0.15, 16):
    for c30 in [0.08, 0.15, 0.25]:
        for c90 in [0.15, 0.30, 0.50]:
            err = get_error([c7, c30, c90])
            if err < 0.015:
                print(f"  coef_7={c7:.3f}, coef_30={c30:.3f}, coef_90={c90:.3f} -> MAE={err * 100:.4f}%")
