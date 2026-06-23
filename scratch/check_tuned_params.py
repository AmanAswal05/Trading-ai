import pandas as pd
import numpy as np
from pathlib import Path

# Load enriched predictions
enriched_path = Path("artifacts/trading-pipeline/enriched_predictions.csv")
edf = pd.read_csv(enriched_path)

print("Columns in enriched_predictions:")
print([col for col in edf.columns if "tradeable" in col or "filter" in col or "thresh" in col])

print("\nValue counts of oof_tradeable_signal:")
print(edf["oof_tradeable_signal"].value_counts(dropna=False))

print("\nValue counts of is_tradeable_signal:")
print(edf["is_tradeable_signal"].value_counts(dropna=False))

# Calculate median error for both
actual = pd.to_numeric(edf["actual_price"], errors="coerce")
pred = pd.to_numeric(edf["prediction"], errors="coerce")
err = (actual - pred).abs() / actual

print("\nMedian error for oof_tradeable_signal == True:")
print(err[edf["oof_tradeable_signal"] == True].median() * 100, "%")

print("\nMedian error for is_tradeable_signal == True:")
print(err[edf["is_tradeable_signal"] == True].median() * 100, "%")
