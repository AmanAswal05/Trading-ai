import pandas as pd

edf = pd.read_csv("artifacts/trading-pipeline/enriched_predictions.csv")
print("Filter value counts for full-fit:")
for col in ['meets_timeframe_filter', 'meets_historical_filter', 'meets_probability_filter', 'meets_symbol_filter', 'meets_setup_filter', 'is_tradeable_signal']:
    print(f"\n{col}:")
    print(edf[col].value_counts(dropna=False))

print("\nTradeable reasons:")
print(edf["tradeable_reason"].value_counts())
