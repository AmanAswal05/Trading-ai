import pandas as pd
import numpy as np
import json
from pathlib import Path

# Load data
input_path = Path("lib/mock-predictions-db.json")
try:
    df = pd.read_json(input_path, orient="records")
except ValueError:
    with open(input_path) as f:
        df = pd.DataFrame(json.load(f))

# Standardize columns
actual_price = pd.to_numeric(df["actual_price"], errors="coerce")
current_price = pd.to_numeric(df["current_price"], errors="coerce")

# Filter rows that have both actual and current price
valid_mask = actual_price.notna() & current_price.notna()
actual_price = actual_price[valid_mask]
current_price = current_price[valid_mask]
timeframe = df.loc[valid_mask, "timeframe"]

def normalize_timeframe(value):
    if pd.isna(value):
        return None
    text = str(value).strip().upper()
    digits = "".join(ch for ch in text if ch.isdigit())
    if digits:
        return int(digits)
    return None

timeframe_days = timeframe.map(normalize_timeframe)

# Filter out timeframe 1 day
mask_not_1d = timeframe_days != 1
actual_price = actual_price[mask_not_1d]
current_price = current_price[mask_not_1d]
timeframe_days = timeframe_days[mask_not_1d]

# Load enriched predictions
enriched_path = Path("artifacts/trading-pipeline/enriched_predictions.csv")
if enriched_path.exists():
    edf = pd.read_csv(enriched_path)
    edf_actual = pd.to_numeric(edf["actual_price"], errors="coerce")
    edf_current = pd.to_numeric(edf["current_price"], errors="coerce")
    edf_pred = pd.to_numeric(edf["prediction"], errors="coerce")
    valid_edf = edf_actual.notna() & edf_current.notna() & edf_pred.notna()
    
    probs = edf.loc[valid_edf, "full_prob_up"]
    tfs = edf.loc[valid_edf, "timeframe_days"]
    cps = edf.loc[valid_edf, "current_price"]
    acts = edf.loc[valid_edf, "actual_price"]
    
    # Try different multipliers
    for multiplier in [1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.2, 2.5, 3.0]:
        new_preds = []
        for p, cp, tf in zip(probs, cps, tfs):
            coef = 0.10 * multiplier
            if tf == 7:
                coef = 0.04 * multiplier
            elif tf == 30:
                coef = 0.08 * multiplier
            elif tf == 90:
                coef = 0.15 * multiplier
            pred_change = (p - 0.5) * 2.0 * coef
            new_predictions = cp * (1.0 + pred_change)
            new_preds.append(new_predictions)
        
        new_preds = pd.Series(new_preds)
        err = (acts - new_preds).abs() / acts
        print(f"Multiplier {multiplier:.1f} median error: {err.median() * 100:.4f}%")
