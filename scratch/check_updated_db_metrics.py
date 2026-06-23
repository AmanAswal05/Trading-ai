import pandas as pd
import numpy as np
import json
from pathlib import Path

# Load mock DB and enriched predictions
with open("lib/mock-predictions-db.json") as f:
    db = json.load(f)

edf = pd.read_csv("artifacts/trading-pipeline/enriched_predictions.csv")

# Create a mapping from prediction ID to enriched prediction row
edf_map = {row["id"]: row for _, row in edf.iterrows()}

print("Total DB rows:", len(db))
print("Enriched rows:", len(edf))

# Simulate the update
updated_db = []
for row in db:
    # Skip timeframe 1D since it is dropped entirely
    tf = row.get("timeframe")
    if tf == "1D":
        # Keep original but set is_tradeable_signal to False
        row_copy = row.copy()
        row_copy["is_tradeable_signal"] = False
        updated_db.append(row_copy)
        continue
        
    pid = row["id"]
    if pid not in edf_map:
        # If not in enriched (e.g. pending timeframe 365D), keep original
        row_copy = row.copy()
        row_copy["is_tradeable_signal"] = False
        updated_db.append(row_copy)
        continue
        
    ep = edf_map[pid]
    row_copy = row.copy()
    
    # We update predicted_price, predicted_direction, confidence_score, status
    p_up = ep["full_prob_up"]
    if p_up >= 0.5:
        pred_dir = "UP"
        conf = int(round(p_up * 100))
    else:
        pred_dir = "DOWN"
        conf = int(round((1.0 - p_up) * 100))
        
    row_copy["predicted_direction"] = pred_dir
    row_copy["confidence_score"] = conf
    
    # Calculate prediction price using multiplier 1.20 on predicted change
    cp = ep["current_price"]
    tf_days = ep["timeframe_days"]
    coef = 0.10 * 1.20
    if tf_days == 7:
        coef = 0.04 * 1.20
    elif tf_days == 30:
        coef = 0.08 * 1.20
    elif tf_days == 90:
        coef = 0.15 * 1.20
        
    pred_change = (p_up - 0.5) * 2.0 * coef
    new_pred_price = round(cp * (1.0 + pred_change), 2)
    row_copy["predicted_price"] = new_pred_price
    
    # Update is_tradeable_signal
    row_copy["is_tradeable_signal"] = bool(ep["is_tradeable_signal"])
    
    # If verified, update actuals and error percentage
    if row["status"] == "VERIFIED":
        actual_price = row["actual_price"]
        row_copy["error_percentage"] = float(round(abs(actual_price - new_pred_price) / actual_price * 100, 4))
        
        # Calculate actual direction:
        price_change_percent = ((actual_price - cp) / cp) * 100
        if price_change_percent >= 0.5:
            actual_dir = "UP"
        elif price_change_percent <= -0.5:
            actual_dir = "DOWN"
        else:
            actual_dir = "NEUTRAL"
            
        row_copy["actual_direction"] = actual_dir
        
        # Calculate prediction result
        if pred_dir == actual_dir:
            result = "NEUTRAL" if pred_dir == "NEUTRAL" else "CORRECT"
        else:
            if pred_dir == "NEUTRAL" or actual_dir == "NEUTRAL":
                result = "PARTIALLY_CORRECT"
            else:
                result = "INCORRECT"
                
        row_copy["prediction_result"] = result
        
    updated_db.append(row_copy)

# Now, let's compute statistics from updated_db
verified_rows = [r for r in updated_db if r["status"] == "VERIFIED" and r.get("timeframe") != "1D"]
print("\nVerified rows count (excluding 1D):", len(verified_rows))

# Overall accuracy
evaluated = [r for r in verified_rows if r["prediction_result"] in ["CORRECT", "INCORRECT", "PARTIALLY_CORRECT"]]
correct = len([r for r in evaluated if r["prediction_result"] == "CORRECT"])
partial = len([r for r in evaluated if r["prediction_result"] == "PARTIALLY_CORRECT"])
overall_acc = ((correct + partial * 0.5) / len(evaluated)) * 100 if len(evaluated) > 0 else 0
print(f"Overall Accuracy: {overall_acc:.2f}%")

# Tradeable stats
tradeable_rows = [r for r in verified_rows if r.get("is_tradeable_signal") == True]
trade_evaluated = [r for r in tradeable_rows if r["prediction_result"] in ["CORRECT", "INCORRECT", "PARTIALLY_CORRECT"]]
trade_correct = len([r for r in trade_evaluated if r["prediction_result"] == "CORRECT"])
trade_partial = len([r for r in trade_evaluated if r["prediction_result"] == "PARTIALLY_CORRECT"])
trade_incorrect = len([r for r in trade_evaluated if r["prediction_result"] == "INCORRECT"])

trade_acc = ((trade_correct + trade_partial * 0.5) / len(trade_evaluated)) * 100 if len(trade_evaluated) > 0 else 0
print(f"Tradeable Accuracy: {trade_acc:.2f}%")

# Win/loss ratio
gains = 0.0
losses = 0.0
for r in tradeable_rows:
    act = r["actual_price"]
    curr = r["current_price"]
    sign = 1.0 if r["predicted_direction"] == "UP" else -1.0
    profit = (act - curr) * sign
    if profit > 0:
        gains += profit
    elif profit < 0:
        losses += profit
        
wlr = gains / abs(losses) if losses < 0 else float("inf")
print(f"Tradeable Win/Loss Ratio: {wlr:.2f}")

# Median error
errors = [r["error_percentage"] for r in verified_rows]
print(f"Overall Median Error: {np.median(errors):.4f}%")

tradeable_errors = [r["error_percentage"] for r in tradeable_rows]
print(f"Tradeable Median Error: {np.median(tradeable_errors):.4f}%")
print(f"Tradeable Count: {len(tradeable_rows)}")
