import pandas as pd
import numpy as np
from pathlib import Path

# Load enriched predictions
enriched_path = Path("artifacts/trading-pipeline/enriched_predictions.csv")
edf = pd.read_csv(enriched_path)

# Filter by rows evaluated in walk-forward (oof_prob_up is not null)
valid_mask = edf["oof_prob_up"].notna()
edf_eval = edf[valid_mask].copy()

actual = pd.to_numeric(edf_eval["actual_price"], errors="coerce")
current = pd.to_numeric(edf_eval["current_price"], errors="coerce")
pred = pd.to_numeric(edf_eval["prediction"], errors="coerce")

print("Evaluated rows count:", len(edf_eval))

# Baseline current price error
err_current = (actual - current).abs() / actual
print(f"Baseline current price median absolute error: {err_current.median() * 100:.4f}%")

# Prediction error in walk-forward
err_pred = (actual - pred).abs() / actual
print(f"Walk-forward prediction median absolute error: {err_pred.median() * 100:.4f}%")

# Let's inspect the error by timeframe in the evaluated set
for tf in [7, 30, 90]:
    tf_mask = edf_eval["timeframe_days"] == tf
    subset = edf_eval[tf_mask]
    if len(subset) == 0:
        continue
    act_tf = pd.to_numeric(subset["actual_price"], errors="coerce")
    curr_tf = pd.to_numeric(subset["current_price"], errors="coerce")
    pred_tf = pd.to_numeric(subset["prediction"], errors="coerce")
    
    err_curr_tf = (act_tf - curr_tf).abs() / act_tf
    err_pred_tf = (act_tf - pred_tf).abs() / act_tf
    print(f"Timeframe {tf}D:")
    print(f"  Count: {len(subset)}")
    print(f"  Baseline error: {err_curr_tf.median() * 100:.4f}%")
    print(f"  Prediction error: {err_pred_tf.median() * 100:.4f}%")
