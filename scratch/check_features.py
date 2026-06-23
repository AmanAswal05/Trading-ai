import pandas as pd
from pathlib import Path
from scripts.trading_prediction_pipeline import (
    load_dataframe,
    prepare_base_frame,
    compute_market_regime_features,
    add_cross_asset_context_features,
    add_multi_horizon_features,
    impute_indicator_values,
    add_regime_interaction_features,
    select_feature_columns,
    clean_prediction_frame
)

input_path = Path("lib/mock-predictions-db.json")
raw = load_dataframe(input_path)
base_frame, symbol_col, timeframe_col, date_col, price_col = prepare_base_frame(raw)
base_frame = base_frame.loc[base_frame[timeframe_col] != 1].copy()

base_frame = compute_market_regime_features(base_frame, symbol_col, date_col, price_col)
base_frame = add_cross_asset_context_features(base_frame, symbol_col, date_col, "current_price")
base_frame = add_multi_horizon_features(base_frame, symbol_col, date_col, "current_price")
base_frame = impute_indicator_values(base_frame, symbol_col, date_col)
base_frame = add_regime_interaction_features(base_frame)

frame = clean_prediction_frame(base_frame)
valid_mask = frame["actual_price"].notna() & frame["current_price"].notna()
frame = frame.loc[valid_mask].copy()

numeric_cols, categorical_cols = select_feature_columns(frame, symbol_col, timeframe_col)
print("Numeric columns:")
print(numeric_cols)
print("\nCategorical columns:")
print(categorical_cols)
