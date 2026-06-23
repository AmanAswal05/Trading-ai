import pandas as pd
import numpy as np
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
    walk_forward_evaluation
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

# Run search loop
min_hist_acc = 0.55
min_hist_wlr = 1.20
min_prob_thresh = 0.60

for iteration in range(12):
    evaluated, fold_metrics, fold_summary, overall_metrics, calibration_curves = walk_forward_evaluation(
        model_frame,
        symbol_col=symbol_col,
        timeframe_col=timeframe_col,
        date_col=date_col,
        n_splits=5,
        random_state=42,
        batch_size=100000,
        min_hist_acc=min_hist_acc,
        min_hist_wlr=min_hist_wlr,
        min_prob_thresh=min_prob_thresh,
    )
    
    tradeable_acc = overall_metrics.get("tradeable_accuracy", 0.0)
    tradeable_wlr = overall_metrics.get("win_loss_ratio", 0.0)
    tradeable_count = overall_metrics.get("tradeable_count", 0)
    
    if pd.isna(tradeable_acc):
        tradeable_acc = 0.0
    if pd.isna(tradeable_wlr):
        tradeable_wlr = 0.0
        
    print(f"Iteration {iteration}: min_hist_acc={min_hist_acc:.3f}, min_hist_wlr={min_hist_wlr:.3f}, min_prob_thresh={min_prob_thresh:.3f} -> tradeable_count={tradeable_count}, tradeable_acc={tradeable_acc*100:.2f}%, wlr={tradeable_wlr:.2f}")
    
    if tradeable_count >= 50 and tradeable_acc >= 0.58 and tradeable_wlr > 1.30:
        print("Tuning loop finished successfully!")
        break
        
    if tradeable_count < 50:
        min_hist_acc = max(0.40, min_hist_acc - 0.02)
        min_hist_wlr = max(0.80, min_hist_wlr - 0.05)
        min_prob_thresh = max(0.50, min_prob_thresh - 0.01)
    else:
        if tradeable_acc < 0.58 or tradeable_wlr <= 1.30:
            min_prob_thresh = min(0.68, min_prob_thresh + 0.01)
            min_hist_acc = max(0.40, min_hist_acc - 0.01)
        else:
            break
            
print(f"Final chosen params: min_hist_acc={min_hist_acc:.3f}, min_hist_wlr={min_hist_wlr:.3f}, min_prob_thresh={min_prob_thresh:.3f}")
