import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.model_selection import TimeSeriesSplit
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from scripts.trading_prediction_pipeline import (
    load_dataframe,
    prepare_base_frame,
    compute_market_regime_features,
    add_cross_asset_context_features,
    add_multi_horizon_features,
    impute_indicator_values,
    add_regime_interaction_features,
    select_feature_columns,
    build_preprocessor,
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

# Target for regression
frame["actual_return"] = (frame["actual_price"] - frame["current_price"]) / frame["current_price"]

numeric_cols, categorical_cols = select_feature_columns(frame, symbol_col, timeframe_col)
if "actual_return" in numeric_cols:
    numeric_cols.remove("actual_return")

print("Numeric features used in regression:")
print(numeric_cols)

splitter = TimeSeriesSplit(n_splits=5)
X = frame[numeric_cols + categorical_cols]
y_reg = frame["actual_return"]
cps = frame["current_price"].to_numpy()
acts = frame["actual_price"].to_numpy()

oof_pred_return = np.zeros(len(frame))

for train_idx, test_idx in splitter.split(frame):
    X_train, y_train = X.iloc[train_idx], y_reg.iloc[train_idx]
    X_test = X.iloc[test_idx]
    
    preprocessor = build_preprocessor(numeric_cols, categorical_cols)
    model = Pipeline([
        ("prep", preprocessor),
        ("reg", GradientBoostingRegressor(n_estimators=100, max_depth=3, random_state=42))
    ])
    
    model.fit(X_train, y_train)
    oof_pred_return[test_idx] = model.predict(X_test)

# Evaluate error
evaluated_mask = oof_pred_return != 0
pred_prices = cps[evaluated_mask] * (1.0 + oof_pred_return[evaluated_mask])
actual_prices = acts[evaluated_mask]

err = np.abs(actual_prices - pred_prices) / actual_prices
print(f"Fixed Regression walk-forward median absolute error: {np.median(err) * 100:.4f}%")
