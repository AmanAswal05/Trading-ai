import pandas as pd
import numpy as np
from pathlib import Path

# Load predictions
enriched_path = Path("artifacts/trading-pipeline/enriched_predictions.csv")
edf = pd.read_csv(enriched_path)

# Filter by verified and full-fit tradeable
full_tradeable = edf["is_tradeable_signal"] == True
edf_tradeable = edf[full_tradeable].copy()

actual = pd.to_numeric(edf_tradeable["actual_price"], errors="coerce").to_numpy()
current = pd.to_numeric(edf_tradeable["current_price"], errors="coerce").to_numpy()
full_prob = edf_tradeable["full_prob_up"].to_numpy()
tfs = edf_tradeable["timeframe_days"].to_numpy()

print(f"Number of full-fit tradeable signals: {len(edf_tradeable)}")

for multiplier in np.linspace(0.0, 1.5, 31):
    new_preds = []
    for p, cp, tf in zip(full_prob, current, tfs):
        coef = 0.10 * multiplier
        if tf == 7:
            coef = 0.04 * multiplier
        elif tf == 30:
            coef = 0.08 * multiplier
        elif tf == 90:
            coef = 0.15 * multiplier
        pred_change = (p - 0.5) * 2.0 * coef
        new_preds.append(round(cp * (1.0 + pred_change), 2))
        
    new_preds = np.array(new_preds)
    err = np.abs(actual - new_preds) / actual
    print(f"Multiplier {multiplier:.2f} -> Median tradeable error: {np.median(err) * 100:.4f}%")
