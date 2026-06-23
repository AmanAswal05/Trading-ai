import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score

edf = pd.read_csv("artifacts/trading-pipeline/enriched_predictions.csv")
tradeable = edf[edf["is_tradeable_signal"] == True]

print("Full-fit Tradeable Signals Count:", len(tradeable))

# Calculate accuracy
y_true = tradeable["y_dir"].astype(int)
y_pred = (tradeable["full_prob_up"] >= 0.5).astype(int)
acc = accuracy_score(y_true, y_pred)
print(f"Accuracy: {acc * 100:.4f}%")

# Calculate win/loss ratio
actual = pd.to_numeric(tradeable["actual_price"], errors="coerce")
current = pd.to_numeric(tradeable["current_price"], errors="coerce")
direction_sign = np.where(y_pred == 1, 1.0, -1.0)
profits = (actual - current) * direction_sign
gains = profits[profits > 0].sum()
losses = profits[profits < 0].sum()
wlr = gains / abs(losses) if losses < 0 else (np.inf if gains > 0 else np.nan)
print(f"Win/Loss Ratio: {wlr:.4f}")

# Calculate median error
err = (actual - tradeable["prediction"]).abs() / actual
print(f"Median Error: {err.median() * 100:.4f}%")
