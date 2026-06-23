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

# Compute returns
actual = pd.to_numeric(vdf["actual_price"], errors="coerce")
current = pd.to_numeric(vdf["current_price"], errors="coerce")
vdf["actual_return"] = (actual - current) / current

for tf in [7, 30, 90]:
    tf_mask = vdf["timeframe_days"] == tf
    subset = vdf[tf_mask]
    if len(subset) == 0:
        continue
    rets = subset["actual_return"]
    print(f"Timeframe {tf}D:")
    print(f"  Median return: {rets.median() * 100:.4f}%")
    print(f"  Median absolute return: {rets.abs().median() * 100:.4f}%")
    print(f"  Mean return: {rets.mean() * 100:.4f}%")
    print(f"  Mean absolute return: {rets.abs().mean() * 100:.4f}%")
