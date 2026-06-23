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

print("Number of verified rows (excluding 1D):", len(vdf))

# Compute relative error for predicted_price
actual = pd.to_numeric(vdf["actual_price"], errors="coerce")
pred = pd.to_numeric(vdf["predicted_price"], errors="coerce")
current = pd.to_numeric(vdf["current_price"], errors="coerce")

error = (actual - pred).abs() / actual
print("Median relative error of original predictions:", error.median() * 100, "%")

# Check if there is an error_percentage column in vdf
if "error_percentage" in vdf.columns:
    original_error_pct = pd.to_numeric(vdf["error_percentage"], errors="coerce")
    print("Median of original error_percentage column:", original_error_pct.median(), "%")

# What if we only evaluate on the test folds or walk-forward sets?
# Let's check how the pipeline does.
# Wait, let's check what features the pipeline writes out in enriched_predictions.csv.
