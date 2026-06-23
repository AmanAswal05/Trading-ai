import pandas as pd
import numpy as np
import json
from pathlib import Path
from scripts.trading_prediction_pipeline import (
    load_dataframe,
    prepare_base_frame,
    compute_market_regime_features,
    add_cross_asset_context_features,
    add_multi_horizon_features,
    impute_indicator_values,
    add_regime_interaction_features,
    prepare_model_matrix,
    walk_forward_evaluation,
    relative_median_absolute_error
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

model_frame, y, numeric_cols, categorical_cols = prepare_model_matrix(base_frame, symbol_col, timeframe_col, date_col)
model_frame["y_dir"] = y.values

# Run walk forward evaluation with tuned thresholds
frame, fold_metrics, fold_summary, overall_metrics, calibration_curves = walk_forward_evaluation(
    model_frame,
    symbol_col=symbol_col,
    timeframe_col=timeframe_col,
    date_col=date_col,
    n_splits=5,
    random_state=42,
    batch_size=100000,
    min_hist_acc=0.55,
    min_hist_wlr=1.20,
    min_prob_thresh=0.60,
)

print("Overall metrics from walk_forward_evaluation:")
print(json.dumps(overall_metrics, indent=2))

# Let's inspect frame.loc[pd.notna(frame['oof_prob_up']), 'prediction']
valid_mask = frame["oof_prob_up"].notna()
actual_prices = pd.to_numeric(frame.loc[valid_mask, "actual_price"], errors="coerce")
pred_prices = pd.to_numeric(frame.loc[valid_mask, "prediction"], errors="coerce")

print("Evaluated count:", len(actual_prices))
print("Any null in pred_prices:", pred_prices.isna().any())

err_manual = (actual_prices - pred_prices).abs() / actual_prices
print(f"Manual relative_median_absolute_error on frame: {err_manual.median() * 100:.4f}%")
