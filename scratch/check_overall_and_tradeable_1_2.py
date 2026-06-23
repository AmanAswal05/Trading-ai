import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.metrics import accuracy_score

# Load predictions
enriched_path = Path("artifacts/trading-pipeline/enriched_predictions.csv")
edf = pd.read_csv(enriched_path)

# Filter by verified and full-fit tradeable
valid_mask = edf["oof_prob_up"].notna()
edf_eval = edf[valid_mask].copy()

actual = pd.to_numeric(edf_eval["actual_price"], errors="coerce").to_numpy()
current = pd.to_numeric(edf_eval["current_price"], errors="coerce").to_numpy()
oof_prob = edf_eval["oof_prob_up"].to_numpy()
tfs = edf_eval["timeframe_days"].to_numpy()
oof_tradeable = edf_eval["oof_tradeable_signal"] == True
y_dir = edf_eval["y_dir"].to_numpy()

# Calculate OOF prediction with multiplier 1.2
coef_mult = 1.2
oof_preds = []
for p, cp, tf in zip(oof_prob, current, tfs):
    coef = 0.10 * coef_mult
    if tf == 7:
        coef = 0.04 * coef_mult
    elif tf == 30:
        coef = 0.08 * coef_mult
    elif tf == 90:
        coef = 0.15 * coef_mult
    pred_change = (p - 0.5) * 2.0 * coef
    oof_preds.append(round(cp * (1.0 + pred_change), 2))

oof_preds = np.array(oof_preds)
err_oof = np.abs(actual - oof_preds) / actual
print(f"Overall OOF Median Error: {np.median(err_oof) * 100:.4f}%")

# Calculate error on tradeable signals
if oof_tradeable.sum() > 0:
    err_tradeable = np.abs(actual[oof_tradeable] - oof_preds[oof_tradeable]) / actual[oof_tradeable]
    print(f"Tradeable OOF Median Error: {np.median(err_tradeable) * 100:.4f}%")
    
    # Calculate tradeable accuracy
    pred_label = (oof_prob[oof_tradeable] >= 0.5).astype(int)
    y_tradeable = y_dir[oof_tradeable].astype(int)
    acc_tradeable = accuracy_score(y_tradeable, pred_label)
    print(f"Tradeable OOF Accuracy: {acc_tradeable * 100:.4f}%")
    
    # Win loss ratio
    direction_sign = np.where(pred_label == 1, 1.0, -1.0)
    profits = (actual[oof_tradeable] - current[oof_tradeable]) * direction_sign
    gains = profits[profits > 0].sum()
    losses = profits[profits < 0].sum()
    wlr = gains / abs(losses) if losses < 0 else (np.inf if gains > 0 else np.nan)
    print(f"Tradeable OOF Win/Loss Ratio: {wlr:.4f}")
