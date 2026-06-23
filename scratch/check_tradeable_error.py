import pandas as pd
import numpy as np
from pathlib import Path

# Load predictions
enriched_path = Path("artifacts/trading-pipeline/enriched_predictions.csv")
edf = pd.read_csv(enriched_path)
edf_actual = pd.to_numeric(edf["actual_price"], errors="coerce")
edf_pred = pd.to_numeric(edf["prediction"], errors="coerce")

# Check overall median absolute error
valid_mask = edf_actual.notna() & edf_pred.notna()
err_all = (edf_actual[valid_mask] - edf_pred[valid_mask]).abs() / edf_actual[valid_mask]
print(f"Overall median absolute error: {err_all.median() * 100:.4f}%")

# Check median absolute error for tradeable signals
# Wait, let's look at oof_tradeable_signal or is_tradeable_signal
# For out-of-fold evaluated metrics:
oof_tradeable = edf["oof_tradeable_signal"] == True
valid_oof_tradeable = valid_mask & oof_tradeable
if valid_oof_tradeable.sum() > 0:
    err_tradeable = (edf_actual[valid_oof_tradeable] - edf_pred[valid_oof_tradeable]).abs() / edf_actual[valid_oof_tradeable]
    print(f"OOF Tradeable signals median absolute error: {err_tradeable.median() * 100:.4f}%")
    print(f"OOF Tradeable signals count: {valid_oof_tradeable.sum()}")
else:
    print("No OOF tradeable signals found in the file.")
    
# For full-fit tradeable signals:
full_tradeable = edf["is_tradeable_signal"] == True
valid_full_tradeable = valid_mask & full_tradeable
if valid_full_tradeable.sum() > 0:
    err_full_tradeable = (edf_actual[valid_full_tradeable] - edf_pred[valid_full_tradeable]).abs() / edf_actual[valid_full_tradeable]
    print(f"Full-fit Tradeable signals median absolute error: {err_full_tradeable.median() * 100:.4f}%")
    print(f"Full-fit Tradeable signals count: {valid_full_tradeable.sum()}")
