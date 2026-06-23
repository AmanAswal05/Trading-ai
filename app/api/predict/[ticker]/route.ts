import { NextRequest, NextResponse } from 'next/server';
import { generatePrediction } from '@/lib/prediction-engine';
import { PredictionsDbService } from '@/lib/predictions-db';
import { supabase } from '@/lib/supabase';
import { getStockDataInternal } from '@/lib/stock-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();

  // Read search parameters for timeframe and modelVersion
  const searchParams = request.nextUrl.searchParams;
  const timeframe = searchParams.get('timeframe') || '7D'; // 1D, 7D, 30D, 90D, 365D
  const modelVersion = searchParams.get('model') || 'V1'; // V1, V2, V3

  try {
    // Call our internal stock details directly (bypasses HTTP fetch)
    const stockData = await getStockDataInternal(ticker);
    
    // Read custom tuning config if stored in cookie
    const tuningCookie = request.cookies.get('sp_ai_tuning');
    let tuningConfig = undefined;
    if (tuningCookie) {
      try {
        tuningConfig = JSON.parse(decodeURIComponent(tuningCookie.value));
      } catch (e) {
        console.error('Failed to parse tuning config cookie:', e);
      }
    }
    
    // Generate prediction using target model version and timeframe
    const prediction = generatePrediction(
      ticker,
      stockData.quote.price,
      stockData.quote.volume,
      stockData.history,
      stockData.indicators,
      tuningConfig,
      modelVersion as 'V1' | 'V2' | 'V3',
      timeframe,
      undefined, // historicalContext
      undefined, // calibrationResult
      undefined, // scaledFeatures
      'BASELINE', // ablationGroup
      undefined, // rawFeatures
      undefined, // tradeFilterThresholds
      undefined, // ensembleMetrics
      undefined, // macroContext
      undefined, // sector
      stockData.source // dataSource
    );

    // Calculate a point forecast predicted_price
    let priceCoef = 0.04;
    if (timeframe === '1D') priceCoef = 0.015;
    else if (timeframe === '30D') priceCoef = 0.08;
    else if (timeframe === '90D') priceCoef = 0.15;
    else if (timeframe === '365D') priceCoef = 0.35;

    let predictedPrice = stockData.quote.price;
    if (prediction.direction === 'UP') {
      predictedPrice = stockData.quote.price * (1 + (prediction.confidence / 100) * priceCoef);
    } else if (prediction.direction === 'DOWN') {
      predictedPrice = stockData.quote.price * (1 - (prediction.confidence / 100) * priceCoef);
    }
    predictedPrice = Number(predictedPrice.toFixed(2));

    // Search historical predictions for similar setup directional accuracy
    const similarSetup = await PredictionsDbService.getSimilarSetupsAccuracy(
      timeframe,
      prediction.confidence,
      ticker
    );

    // Resolve user ID if authenticated
    let userId = null;
    try {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) userId = user.id;
      } else {
        const mockUserCookie = request.cookies.get('sp_mock_user');
        if (mockUserCookie) userId = 'mock-user-id';
      }
    } catch (err) {
      console.warn('Failed to parse user for prediction logging:', err);
    }

    // Save prediction record with nested explainability & metrics
    await PredictionsDbService.logPrediction({
      user_id: userId,
      ticker,
      prediction_date: new Date().toISOString(),
      timeframe,
      current_price: stockData.quote.price,
      predicted_price: predictedPrice,
      predicted_direction: prediction.direction,
      confidence_score: prediction.confidence,
      signal_strength: prediction.signalStrength,
      confidence_before_filter: prediction.confidenceBeforeFilter,
      confidence_after_filter: prediction.confidenceAfterFilter ?? prediction.confidence,
      signal_quality: prediction.signalQuality,
      filter_reason: prediction.filterReason,
      is_tradeable_signal: prediction.isTradeableSignal,
      max_position_size: prediction.maxPositionSize,
      calibrated_prob_up: prediction.direction === 'UP'
        ? prediction.confidence / 100
        : prediction.direction === 'DOWN'
          ? 1 - prediction.confidence / 100
          : 0.5,
      reliability_grade: prediction.reliabilityGrade,
      stock_reliability_score: prediction.stockReliabilityScore,
      timeframe_reliability_score: prediction.timeframeReliabilityScore,
      reliability_warnings: prediction.reliabilityWarnings,
      regime: prediction.regime,
      volatility_level: prediction.riskTier,
      indicator_setup: prediction.explainability
        ? `${prediction.explainability.trendContribution >= prediction.explainability.volumeContribution ? 'trend' : 'volume'}+${prediction.explainability.macdContribution >= prediction.explainability.rsiContribution ? 'macd' : 'rsi'}`
        : undefined,
      model_version: modelVersion as 'V1' | 'V2' | 'V3',
      metrics: prediction.probabilities ? {
        bullish_probability: prediction.probabilities.bullish,
        bearish_probability: prediction.probabilities.bearish,
        neutral_probability: prediction.probabilities.neutral,
        bear_case_return: prediction.expectedReturns?.bear || 0,
        base_case_return: prediction.expectedReturns?.base || 0,
        bull_case_return: prediction.expectedReturns?.bull || 0,
        risk_score: prediction.riskScore || 5,
        volatility_score: prediction.volatilityScore || 5,
      } : undefined,
      explanation: prediction.explainability ? {
        rsi_contribution: prediction.explainability.rsiContribution,
        macd_contribution: prediction.explainability.macdContribution,
        trend_contribution: prediction.explainability.trendContribution,
        volume_contribution: prediction.explainability.volumeContribution,
        volatility_contribution: prediction.explainability.volatilityContribution,
        sentiment_contribution: prediction.explainability.sentimentContribution,
        support_resistance_contribution: prediction.explainability.supportResistanceContribution,
        ai_reasoning_summary: prediction.explainability.aiReasoningSummary,
      } : undefined,
      similar_accuracy: similarSetup.successRate,
      similar_verified_count: similarSetup.verifiedCount,
    });

    // Attach target price and similar setups to response for frontend
    const responsePayload = {
      ...prediction,
      predictedPrice,
      timeframe,
      similarSetup,
      reliabilityWarnings: prediction.reliabilityWarnings || [],
    };

    return NextResponse.json(responsePayload);
  } catch (err: unknown) {
    console.error(`Prediction calculation/logging failed for ${ticker}:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to calculate prediction' },
      { status: 500 }
    );
  }
}
