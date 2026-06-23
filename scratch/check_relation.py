import pandas as pd
import numpy as np
import json
from pathlib import Path
from sklearn.linear_model import LinearRegression

# Load data
input_path = Path("lib/mock-predictions-db.json")
try:
    df = pd.read_json(input_path, orient="records")
except ValueError:
    with open(input_path) as f:
        df = pd.DataFrame(json.load(f))

# Helper to normalize timeframe
def normalize_timeframe(value):
    if pd.isna(value):
        return None
    text = str(value).strip().upper()
    digits = "".join(ch for ch in text if ch.isdigit())
    if digits:
        return int(digits)
    return None

df["timeframe_days"] = df["timeframe"].map(normalize_timeframe)

# Identify verified rows
status = df["status"].astype(str).str.upper()
verified_mask = status.eq("VERIFIED")

# Filter
vdf = df[verified_mask & (df["timeframe_days"] != 1)].copy()

actual = pd.to_numeric(vdf["actual_price"], errors="coerce")
current = pd.to_numeric(vdf["current_price"], errors="coerce")
pred = pd.to_numeric(vdf["predicted_price"], errors="coerce")

vdf["actual_return"] = (actual - current) / current
vdf["pred_return"] = (pred - current) / current

# Linear regression
X = vdf[["pred_return"]].to_numpy()
y = vdf["actual_return"].to_numpy()

reg = LinearRegression().fit(X, y)
print("Slope:", reg.coef_[0])
print("Intercept:", reg.intercept_)
print("R^2 score:", reg.score(X, y))

# Let's see the error of calibrated predictions
calibrated_return = reg.predict(X)
calibrated_price = current * (1.0 + calibrated_return)
err = (actual - calibrated_price).abs() / actual
print(f"Calibrated prediction median absolute error: {err.median() * 100:.4f}%")
