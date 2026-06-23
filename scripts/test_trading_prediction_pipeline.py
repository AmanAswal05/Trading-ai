import unittest

import numpy as np
import pandas as pd

from trading_prediction_pipeline import (
    build_tradeable_mask,
    compute_market_regime_features,
    select_feature_columns,
)


class TradingPredictionPipelineTests(unittest.TestCase):
    def test_prediction_outputs_are_excluded_from_features(self):
        frame = pd.DataFrame({
            "ticker": ["AAPL"],
            "timeframe": ["7D"],
            "market_regime": ["bull"],
            "current_price": [100.0],
            "predicted_price": [105.0],
            "confidence_score": [80.0],
            "confidence_before_filter": [85.0],
            "confidence_after_filter": [80.0],
            "max_position_size": [1.0],
            "rsi": [45.0],
            "macd": [1.2],
        })

        numeric, categorical = select_feature_columns(frame, "ticker", "timeframe")

        self.assertEqual(categorical, ["ticker", "timeframe", "market_regime"])
        self.assertIn("rsi", numeric)
        self.assertIn("macd", numeric)
        self.assertNotIn("predicted_price", numeric)
        self.assertNotIn("confidence_score", numeric)
        self.assertNotIn("max_position_size", numeric)

    def test_tradeable_mask_requires_historical_edge_and_sizes_poor_symbols(self):
        frame = pd.DataFrame({
            "ticker": ["AAPL", "MSFT", "TSLA", "META"],
            "timeframe_days": [7, 30, 90, 7],
            "full_prob_up": [0.70, 0.70, 0.70, 0.70],
            "historical_sample_size": [80, 80, 80, 10],
            "historical_accuracy": [0.60, 0.50, 0.60, 0.60],
            "historical_win_loss_ratio": [1.5, 1.5, 0.9, 1.5],
            "setup_label": ["general"] * 4,
        })

        mask = build_tradeable_mask(frame, "full_prob_up", "ticker", low_symbols={"AAPL"})

        self.assertEqual(mask.tolist(), [True, False, False, False])
        self.assertEqual(frame["max_position_size"].tolist(), [0.25, 0.0, 0.0, 0.0])

    def test_regime_features_use_only_prior_prices(self):
        dates = pd.date_range("2026-01-01", periods=100, tz="UTC")
        prices = np.linspace(100.0, 200.0, 100)
        frame = pd.DataFrame({
            "ticker": ["TEST"] * 100,
            "prediction_date": dates,
            "current_price": prices,
            "market_regime": [None] * 100,
            "status": ["VERIFIED"] * 100,
        })

        result = compute_market_regime_features(
            frame, "ticker", "prediction_date", "current_price"
        )

        self.assertTrue(result["market_regime"].isin({"bull", "bear", "sideways"}).all())
        self.assertAlmostEqual(result.loc[30, "ma30"], prices[:30].mean())

    def test_classify_directional_move_adaptive_band(self):
        from trading_prediction_pipeline import classify_directional_move
        
        # 100 -> 101 (1% move). Volatility expected move: 0.03 * sqrt(7) * 0.5 = 3.96%. 1% < 3.96% => NEUTRAL
        self.assertEqual(classify_directional_move(100.0, 101.0, 0.03, 7), "NEUTRAL")
        
        # 100 -> 105 (5% move). Volatility expected move: 0.02 * sqrt(7) * 0.5 = 2.64%. 5% > 2.64% => UP
        self.assertEqual(classify_directional_move(100.0, 105.0, 0.02, 7), "UP")
        
        # 100 -> 94 (-6% move). Expected move: 2.64%. -6% < -2.64% => DOWN
        self.assertEqual(classify_directional_move(100.0, 94.0, 0.02, 7), "DOWN")


if __name__ == "__main__":
    unittest.main()
