"""
Write calibrated ensemble outputs back to the mock predictions database.

Maps enriched CSV rows to mock DB records using a composite key of
(ticker, prediction_date, timeframe) rather than UUID, because the pipeline
assigns integer row_ids that do not correspond to the UUIDs stored in the JSON
database.

Usage:
    python scripts/write_back_predictions.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _derive_signal_strength(confidence: float) -> str:
    """Convert a 0-1 confidence value to a signal-strength label."""
    pct = max(confidence, 1.0 - confidence) * 100.0
    if pct < 55:
        return "NO_SIGNAL"
    if pct < 65:
        return "WEAK_SIGNAL"
    if pct < 75:
        return "MODERATE_SIGNAL"
    return "STRONG_SIGNAL"


def _normalise_date(value: object) -> str:
    """Return an ISO-date string (YYYY-MM-DD) from any datetime-like value."""
    try:
        ts = pd.Timestamp(value)
        if ts.tzinfo is not None:
            ts = ts.tz_convert("UTC").tz_localize(None)
        return ts.strftime("%Y-%m-%d")
    except Exception:
        return str(value)[:10]


def _normalise_timeframe(value: object) -> str:
    """Normalise integer-day timeframes to the 'NND' string used in the DB."""
    mapping = {"7": "7D", "30": "30D", "90": "90D", "1": "1D", "365": "365D"}
    raw = str(value).strip().upper().rstrip("D")
    return mapping.get(raw, f"{raw}D")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    db_path = Path("lib/mock-predictions-db.json")
    enriched_path = Path("artifacts/trading-pipeline/enriched_predictions.csv")

    if not db_path.exists():
        print(f"[write_back] DB file not found: {db_path}")
        return
    if not enriched_path.exists():
        print(f"[write_back] Enriched CSV not found: {enriched_path} — run the pipeline first.")
        return

    with open(db_path) as fh:
        db: list[dict] = json.load(fh)

    edf = pd.read_csv(enriched_path)

    print(f"[write_back] Loaded {len(db):,} records from {db_path}")
    print(f"[write_back] Loaded {len(edf):,} rows from {enriched_path}")

    # ------------------------------------------------------------------
    # Build a composite-key lookup: (ticker, YYYY-MM-DD, timeframe) → row
    # The pipeline uses integer row_ids, not the UUID primary keys stored
    # in the JSON DB, so we cannot map by ID.
    # ------------------------------------------------------------------
    edf_map: dict[tuple[str, str, str], dict] = {}
    for _, row in edf.iterrows():
        ticker_key = str(row.get("symbol", row.get("ticker", ""))).upper()
        date_key = _normalise_date(row.get("prediction_date", row.get("date", "")))
        tf_key = _normalise_timeframe(row.get("timeframe_days", row.get("timeframe", "")))
        composite = (ticker_key, date_key, tf_key)
        # Keep the last row if there are duplicates (full-fit score preferred).
        edf_map[composite] = dict(row)

    print(f"[write_back] Built composite key map with {len(edf_map):,} entries")

    updated_db: list[dict] = []
    updated_count = 0
    tradeable_count = 0
    calibrated_count = 0

    for record in db:
        tf_raw = record.get("timeframe", "")
        if tf_raw == "1D":
            row_copy = record.copy()
            row_copy["is_tradeable_signal"] = False
            row_copy["max_position_size"] = 0.0
            updated_db.append(row_copy)
            continue

        ticker_key = str(record.get("ticker", "")).upper()
        date_key = _normalise_date(record.get("prediction_date", ""))
        tf_key = str(tf_raw).strip().upper()
        if not tf_key.endswith("D"):
            tf_key = tf_key + "D"

        composite = (ticker_key, date_key, tf_key)
        ep = edf_map.get(composite)

        if ep is None:
            row_copy = record.copy()
            row_copy.setdefault("is_tradeable_signal", False)
            row_copy.setdefault("max_position_size", 0.0)
            updated_db.append(row_copy)
            continue

        row_copy = record.copy()

        # ---- 1. Calibrated probability and direction ----------------------
        # Prefer the full-fit probability; fall back to OOF probability.
        p_up_raw = ep.get("full_prob_up", ep.get("calibrated_prob_up", ep.get("oof_prob_up")))
        if p_up_raw is None or (isinstance(p_up_raw, float) and math.isnan(p_up_raw)):
            updated_db.append(row_copy)
            continue

        p_up = float(p_up_raw)
        row_copy["calibrated_prob_up"] = round(p_up, 6)
        calibrated_count += 1

        if p_up >= 0.5:
            pred_dir = "UP"
            conf = int(round(p_up * 100))
        else:
            pred_dir = "DOWN"
            conf = int(round((1.0 - p_up) * 100))

        row_copy["predicted_direction"] = pred_dir
        row_copy["confidence_score"] = conf

        # ---- 2. Signal strength -------------------------------------------
        row_copy["signal_strength"] = _derive_signal_strength(p_up)
        row_copy["confidence_before_filter"] = record.get("confidence_score", conf)
        row_copy["confidence_after_filter"] = conf

        # ---- 3. Predicted price -------------------------------------------
        cp = float(ep.get("current_price", record.get("current_price", 0)) or 0)
        if cp > 0:
            try:
                tf_days = int(str(ep.get("timeframe_days", 7)).replace("D", ""))
            except (ValueError, TypeError):
                tf_days = 7
            coef = 0.10
            if tf_days == 7:
                coef = 0.04
            elif tf_days == 30:
                coef = 0.08
            elif tf_days == 90:
                coef = 0.15
            pred_change = (p_up - 0.5) * 2.0 * coef
            new_pred_price = round(cp * (1.0 + pred_change), 2)
            row_copy["predicted_price"] = new_pred_price
        else:
            new_pred_price = float(record.get("predicted_price", 0) or 0)

        # ---- 4. Tradeable signal and position size ------------------------
        is_tradeable_raw = ep.get("is_tradeable_signal", False)
        is_tradeable = bool(is_tradeable_raw) if not (
            isinstance(is_tradeable_raw, float) and math.isnan(is_tradeable_raw)
        ) else False
        max_pos_raw = ep.get("max_position_size", 0.0)
        max_pos = float(max_pos_raw) if not (
            isinstance(max_pos_raw, float) and math.isnan(max_pos_raw)
        ) else 0.0
        row_copy["is_tradeable_signal"] = is_tradeable
        row_copy["max_position_size"] = round(max_pos, 6)
        if is_tradeable:
            tradeable_count += 1

        # ---- 5. Market regime -------------------------------------------
        regime_raw = ep.get("market_regime", ep.get("regime"))
        if regime_raw and isinstance(regime_raw, str) and regime_raw.lower() not in ("nan", "none", ""):
            row_copy["regime"] = regime_raw.lower()

        # ---- 6. Verified record recalculation ----------------------------
        if record.get("status") == "VERIFIED" and cp > 0:
            actual_price = float(record.get("actual_price") or 0)
            if actual_price > 0:
                row_copy["error_percentage"] = round(
                    abs(actual_price - new_pred_price) / actual_price * 100, 4
                )
                price_change_pct = ((actual_price - cp) / cp) * 100
                if price_change_pct >= 0.5:
                    actual_dir = "UP"
                elif price_change_pct <= -0.5:
                    actual_dir = "DOWN"
                else:
                    actual_dir = "NEUTRAL"
                row_copy["actual_direction"] = actual_dir

                if pred_dir == actual_dir:
                    result = "NEUTRAL" if pred_dir == "NEUTRAL" else "CORRECT"
                elif pred_dir == "NEUTRAL" or actual_dir == "NEUTRAL":
                    result = "PARTIALLY_CORRECT"
                else:
                    result = "INCORRECT"
                row_copy["prediction_result"] = result

        # ---- 7. Metrics case returns -------------------------------------
        if row_copy.get("metrics") and cp > 0:
            metrics = row_copy["metrics"].copy()
            old_pred = float(record.get("predicted_price") or 0)
            if old_pred != cp:
                scale = (new_pred_price - cp) / (old_pred - cp)
                for key in ("base_case_return", "bull_case_return", "bear_case_return"):
                    if key in metrics and metrics[key] is not None:
                        metrics[key] = round(float(metrics[key]) * scale, 2)
            row_copy["metrics"] = metrics

        updated_db.append(row_copy)
        updated_count += 1

    # ------------------------------------------------------------------
    # Write back
    # ------------------------------------------------------------------
    with open(db_path, "w") as fh:
        json.dump(updated_db, fh, indent=2)

    print(
        f"[write_back] Done: {updated_count:,} records updated | "
        f"{calibrated_count:,} got calibrated_prob_up | "
        f"{tradeable_count:,} marked is_tradeable_signal=True"
    )
    print(f"[write_back] Database saved to {db_path}")


if __name__ == "__main__":
    main()
