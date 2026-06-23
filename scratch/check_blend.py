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

actual = pd.to_numeric(vdf["actual_price"], errors="coerce")
current = pd.to_numeric(vdf["current_price"], errors="coerce")
pred = pd.to_numeric(vdf["predicted_price"], errors="coerce")

for w in np.linspace(0, 1, 21):
    blend = current * w + pred * (1.0 - w)
    err = (actual - blend).abs() / actual
    print(f"Weight on current {w:.2f}: {err.median() * 100:.4f}%")
