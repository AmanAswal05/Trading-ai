import pandas as pd
import numpy as np
from pathlib import Path

# Load predictions
enriched_path = Path("artifacts/trading-pipeline/enriched_predictions.csv")
edf = pd.read_csv(enriched_path)
edf_actual = pd.to_numeric(edf["actual_price"], errors="coerce")
edf_current = pd.to_numeric(edf["current_price"], errors="coerce")
valid_edf = edf_actual.notna() & edf_current.notna()

cps = edf.loc[valid_edf, "current_price"].to_numpy()
acts = edf.loc[valid_edf, "actual_price"].to_numpy()

print("Median relative diff (actual vs current):", np.median(np.abs(acts - cps) / acts) * 100, "%")
