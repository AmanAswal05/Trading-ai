import pandas as pd
import numpy as np
from pathlib import Path

# Load enriched predictions
enriched_path = Path("artifacts/trading-pipeline/enriched_predictions.csv")
edf = pd.read_csv(enriched_path)

# Filter by rows evaluated in walk-forward (oof_prob_up is not null)
valid_mask = edf["oof_prob_up"].notna()
edf_eval = edf[valid_mask].copy()

actual = pd.to_numeric(edf_eval["actual_price"], errors="coerce").to_numpy()
current = pd.to_numeric(edf_eval["current_price"], errors="coerce").to_numpy()
oof_prob = edf_eval["oof_prob_up"].to_numpy()
tfs = edf_eval["timeframe_days"].to_numpy()

# Calculate OOF prediction
oof_preds = []
for p, cp, tf in zip(oof_prob, current, tfs):
    coef = 0.10
    if tf == 7:
        coef = 0.04
    elif tf == 30:
        coef = 0.08
    elif tf == 90:
        coef = 0.15
    pred_change = (p - 0.5) * 2.0 * coef
    oof_preds.append(round(cp * (1.0 + pred_change), 2))

oof_preds = np.array(oof_preds)

err_oof = np.abs(actual - oof_preds) / actual
print(f"Computed OOF prediction median absolute error: {np.median(err_oof) * 100:.4f}%")

# Let's inspect the error by timeframe
for tf in [7, 30, 90]:
    tf_mask = tfs == tf
    err_tf = err_oof[tf_mask]
    print(f"Timeframe {tf}D:")
    print(f"  Count: {tf_mask.sum()}")
    print(f"  OOF Prediction error: {np.median(err_tf) * 100:.4f}%")
