import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.ensemble import GradientBoostingRegressor
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

frame["actual_return"] = (frame["actual_price"] - frame["current_price"]) / frame["current_price"]

numeric_cols, categorical_cols = select_feature_columns(frame, symbol_col, timeframe_col)

X = frame[numeric_cols + categorical_cols]
y_reg = frame["actual_return"]

# Preprocess and fit GBR on the entire set (or split)
preprocessor = build_preprocessor(numeric_cols, categorical_cols)
X_processed = preprocessor.fit_transform(X)

# Get feature names after preprocessing
cat_encoder = preprocessor.named_transformers_["cat"].named_steps["encode"]
feature_names = numeric_cols + list(cat_encoder.get_feature_names_out(categorical_cols))

model = GradientBoostingRegressor(n_estimators=100, max_depth=3, random_state=42)
model.fit(X_processed, y_reg)

# Print top 15 features
importances = model.feature_importances_
indices = np.argsort(importances)[::-1]

print("Top 15 features for predicting actual return:")
for f in range(min(15, len(feature_names))):
    print(f"{f + 1}. {feature_names[indices[f]]}: {importances[indices[f]] * 100:.4f}%")
