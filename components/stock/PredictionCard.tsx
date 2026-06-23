/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import PredictionBadge from '../ui/PredictionBadge';
import ConfidenceGauge from '../ui/ConfidenceGauge';
import PriceRangeBar from '../ui/PriceRangeBar';
import { useCurrency } from '@/lib/currency-context';
import { ShieldCheck, TrendingUp, AlertTriangle, HelpCircle, Activity, Info } from 'lucide-react';

interface PredictionCardProps {
  currentPrice: number;
  prediction: {
    ticker: string;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    targetLow: number;
    targetHigh: number;
    riskTier: 'LOW' | 'MEDIUM' | 'HIGH';
    signalBreakdown: {
      trend: number;
      momentum: number;
      volatility: number;
      volume: number;
    };
    summary: string;
    probabilities?: {
      bullish: number;
      bearish: number;
      neutral: number;
    };
    expectedReturns?: {
      bear: number;
      base: number;
      bull: number;
    };
    riskScore?: number;
    volatilityScore?: number;
    signalStrength?: 'NO_SIGNAL' | 'WEAK_SIGNAL' | 'MODERATE_SIGNAL' | 'STRONG_SIGNAL';
    reliabilityGrade?: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
    reliabilityWarnings?: string[];
    dataQualityScore?: number;
    explainability?: {
      rsiContribution: number;
      macdContribution: number;
      trendContribution: number;
      volumeContribution: number;
      volatilityContribution: number;
      sentimentContribution: number;
      supportResistanceContribution: number;
      aiReasoningSummary: string;
    };
    similarSetup?: {
      successRate: number;
      verifiedCount: number;
    };
    macroContext?: any;
    safetyModeActive?: boolean;
    confidenceBreakdown?: {
      raw: number;
      calibrated: number;
      final: number;
      capReason?: string;
    };
  };
}

export default function PredictionCard({ currentPrice, prediction }: PredictionCardProps) {
  const { direction, confidence, targetLow, targetHigh, riskTier, summary, ticker } =
    prediction;

  const { formatPrice } = useCurrency();

  const riskColors = {
    LOW: 'bg-accent-green/10 text-accent-green border-accent-green/25',
    MEDIUM: 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/25',
    HIGH: 'bg-accent-red/10 text-accent-red border-accent-red/25',
  };

  const similarRate = prediction.similarSetup?.successRate ?? 0;
  const similarCount = prediction.similarSetup?.verifiedCount ?? 0;

  const hasProbabilities = !!prediction.probabilities;
  const bullProb = prediction.probabilities?.bullish ?? 0;
  const bearProb = prediction.probabilities?.bearish ?? 0;
  const neutProb = prediction.probabilities?.neutral ?? 0;

  const hasExpectedReturns = !!prediction.expectedReturns;
  const bearReturn = prediction.expectedReturns?.bear ?? 0;
  const baseReturn = prediction.expectedReturns?.base ?? 0;
  const bullReturn = prediction.expectedReturns?.bull ?? 0;


  const hasExplainability = !!prediction.explainability;
  const explainabilityMetrics = hasExplainability ? [
    { label: 'Trend Strength', val: prediction.explainability!.trendContribution, color: 'bg-accent-blue' },
    { label: 'Volume Flow', val: prediction.explainability!.volumeContribution, color: 'bg-accent-sky' },
    { label: 'Volatility Spread', val: prediction.explainability!.volatilityContribution, color: 'bg-premium-gold' },
    { label: 'RSI Oscillator', val: prediction.explainability!.rsiContribution, color: 'bg-accent-green' },
    { label: 'MACD Momentum', val: prediction.explainability!.macdContribution, color: 'bg-accent-purple' },
    { label: 'Social Sentiment', val: prediction.explainability!.sentimentContribution, color: 'bg-pink-500' },
    { label: 'Support & Resistance', val: prediction.explainability!.supportResistanceContribution, color: 'bg-indigo-500' },
  ].filter(m => m.val !== undefined && m.val !== null).sort((a, b) => b.val - a.val) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 rounded-2xl border border-border-custom bg-bg-card transition-theme shadow-sm">
      
      {/* Column 1: AI Direction, Gauge & Similar Setup (4 cols) */}
      <div className="lg:col-span-4 flex flex-col items-center justify-between p-5 border border-border-custom bg-bg-secondary/25 rounded-2xl transition-theme text-center min-h-[440px]">
        <span className="text-[10px] font-mono font-bold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-accent-blue" /> Machine Learning Output
        </span>
        
        <div className="my-auto py-4 relative">
          {prediction.safetyModeActive && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-red-500/10 border border-red-500/30 text-red-500 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider z-10 whitespace-nowrap">
              <AlertTriangle className="w-3 h-3" /> Safety Mode: ON
            </div>
          )}
          <ConfidenceGauge confidence={confidence} direction={direction} size={130} />
          {prediction.confidenceBreakdown && prediction.confidenceBreakdown.capReason && (
            <div className="mt-4 text-[10px] text-accent-yellow/90 bg-accent-yellow/10 border border-accent-yellow/20 px-2 py-1.5 rounded text-left flex items-start gap-1">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{prediction.confidenceBreakdown.capReason}</span>
            </div>
          )}
        </div>

        <div className="w-full space-y-4">
          <div className="flex flex-col items-center gap-1.5">
            <PredictionBadge direction={direction} className="text-xs px-3.5 py-1.5 font-bold uppercase" />
            {prediction.signalStrength && (
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 border rounded-md uppercase tracking-wider ${
                prediction.signalStrength === 'STRONG_SIGNAL'
                  ? 'bg-accent-green/10 text-accent-green border-accent-green/25'
                  : prediction.signalStrength === 'MODERATE_SIGNAL'
                  ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/25'
                  : prediction.signalStrength === 'WEAK_SIGNAL'
                  ? 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/25'
                  : 'bg-accent-red/10 text-accent-red border-accent-red/25'
              }`}>
                {prediction.signalStrength.replace('_', ' ')}
              </span>
            )}
            
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-mono text-text-secondary">Volatility:</span>
              <span
                className={`text-[9px] font-mono font-bold px-2 py-0.5 border rounded-md uppercase tracking-wider ${
                  riskColors[riskTier]
                }`}
              >
                {riskTier} {prediction.riskScore !== undefined ? `(Risk: ${prediction.riskScore}/100)` : ''}
              </span>
            </div>
          </div>

          {prediction.reliabilityWarnings?.length ? (
            <div className="pt-3 border-t border-border-custom/50 text-left space-y-1.5">
              <span className="text-[9px] uppercase font-bold tracking-wider text-accent-red block">
                Reliability Warning
              </span>
              <p className="text-[10.5px] text-accent-red/90 leading-relaxed">
                {prediction.reliabilityWarnings[0]}
              </p>
            </div>
          ) : null}
          
          {/* Similar Setups Panel */}
          {similarCount > 0 && (
            <div className="pt-3 border-t border-border-custom/50 text-left space-y-1.5">
              <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">
                Similar Setup Accuracy
              </span>
              <p className="text-[10.5px] text-text-secondary leading-relaxed">
                Historically, setups matching similar timeframe and confidence levels achieved <span className="font-bold text-accent-green">{similarRate}%</span> accuracy based on <span className="font-bold text-text-primary">{similarCount}</span> verified predictions.
              </p>
            </div>
          )}

          {/* Data Quality Score (if available) */}
          {prediction.dataQualityScore !== undefined && (
            <div className="mt-4 pt-4 border-t border-border-custom w-full">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-text-secondary flex items-center">
                  Data Quality
                </span>
                <span className={`font-semibold ${prediction.dataQualityScore < 60 ? 'text-accent-red' : prediction.dataQualityScore < 80 ? 'text-accent-yellow' : 'text-accent-green'}`}>
                  {prediction.dataQualityScore}/100
                </span>
              </div>
              {prediction.dataQualityScore < 60 && (
                <div className="mt-2 text-xs text-accent-red/90 bg-accent-red/10 p-2 rounded-md flex items-start text-left">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 mt-0.5" />
                  <span className="leading-tight">Unreliable data detected. Prediction confidence capped.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Column 2: User Trust Panel & Explainability (8 cols) */}
      <div className="lg:col-span-8 flex flex-col justify-between gap-6">
        
        {/* Top: Probabilities Grid & Returns Scenario */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Bullish / Bearish / Neutral Probabilities */}
          {hasProbabilities && (
            <div className="p-4 border border-border-custom bg-bg-secondary/15 rounded-xl flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[9px] font-mono font-bold text-text-muted uppercase tracking-wider">
                  Directional Probabilities
                </span>
                <h4 className="text-xs font-bold text-text-primary mt-0.5">Model Logistic Outputs</h4>
              </div>

              {/* Visual Probability Meter */}
              <div className="space-y-2.5">
                <div className="w-full h-3.5 bg-bg-secondary border border-border-custom rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-accent-green transition-all duration-700" 
                    style={{ width: `${bullProb}%` }} 
                    title={`Bullish: ${bullProb}%`}
                  />
                  <div 
                    className="h-full bg-text-muted/40 transition-all duration-700" 
                    style={{ width: `${neutProb}%` }} 
                    title={`Neutral: ${neutProb}%`}
                  />
                  <div 
                    className="h-full bg-accent-red transition-all duration-700" 
                    style={{ width: `${bearProb}%` }} 
                    title={`Bearish: ${bearProb}%`}
                  />
                </div>
                
                <div className="grid grid-cols-3 text-[10px] font-mono font-bold text-center border-t border-border-custom/30 pt-1.5">
                  <div className="text-accent-green">Bull: {bullProb}%</div>
                  <div className="text-text-secondary">Neut: {neutProb}%</div>
                  <div className="text-accent-red">Bear: {bearProb}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Confidence Breakdown Panel */}
          {prediction.confidenceBreakdown && (
            <div className="p-4 border border-border-custom bg-bg-secondary/15 rounded-xl flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[9px] font-mono font-bold text-text-muted uppercase tracking-wider">
                  Confidence Origin
                </span>
                <h4 className="text-xs font-bold text-text-primary mt-0.5">Scoring Breakdown</h4>
              </div>

              <div className="space-y-1.5 text-[10.5px] font-mono">
                <div className="flex justify-between items-center text-text-secondary">
                  <span>Raw Indicators:</span>
                  <span>{prediction.confidenceBreakdown.raw}%</span>
                </div>
                <div className="flex justify-between items-center border-y border-border-custom/30 py-1 text-text-secondary">
                  <span>ML Calibration:</span>
                  <span>{prediction.confidenceBreakdown.calibrated}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-primary font-bold">Final Displayed:</span>
                  <span className={`font-bold ${prediction.confidenceBreakdown.final < prediction.confidenceBreakdown.raw ? 'text-accent-red' : 'text-accent-green'}`}>
                    {prediction.confidenceBreakdown.final}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Scenario Returns Ranges (Wicks) */}
          {hasExpectedReturns && (
            <div className="p-4 border border-border-custom bg-bg-secondary/15 rounded-xl flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[9px] font-mono font-bold text-text-muted uppercase tracking-wider">
                  Expected Returns Ranges
                </span>
                <h4 className="text-xs font-bold text-text-primary mt-0.5">Bear / Base / Bull Scenarios</h4>
              </div>

              <div className="space-y-1.5 text-[10.5px] font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-accent-green font-semibold">Bull Scenario:</span>
                  <span className="text-text-primary font-bold">{bullReturn >= 0 ? '+' : ''}{bullReturn}%</span>
                </div>
                <div className="flex justify-between items-center border-y border-border-custom/30 py-1">
                  <span className="text-text-secondary">Base Scenario:</span>
                  <span className="text-text-primary font-bold">{baseReturn >= 0 ? '+' : ''}{baseReturn}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-accent-red font-semibold">Bear Scenario:</span>
                  <span className="text-text-primary font-bold">{bearReturn >= 0 ? '+' : ''}{bearReturn}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Middle: Macro Context Panel */}
        {prediction.macroContext && (
          <div className="p-4 border border-border-custom bg-bg-secondary/15 rounded-xl flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono font-bold text-text-muted uppercase tracking-wider">
                  Macro Environment
                </span>
                <h4 className="text-xs font-bold text-text-primary mt-0.5 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-accent-primary" /> Systemic Context
                </h4>
              </div>
              <div className={`px-2 py-1 rounded text-[10px] font-mono font-bold border ${prediction.macroContext.bias === 'BULLISH' ? 'bg-accent-green/10 text-accent-green border-accent-green/30' : prediction.macroContext.bias === 'BEARISH' ? 'bg-accent-red/10 text-accent-red border-accent-red/30' : 'bg-text-muted/10 text-text-secondary border-border-custom'}`}>
                {prediction.macroContext.bias} BIAS
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center text-xs border-t border-border-custom/30 pt-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] uppercase text-text-muted font-bold tracking-wider">Macro Risk</span>
                <span className={`font-mono font-bold ${prediction.macroContext.riskScore > 70 ? 'text-accent-red' : prediction.macroContext.riskScore < 30 ? 'text-accent-green' : 'text-text-primary'}`}>
                  {prediction.macroContext.riskScore}/100
                </span>
              </div>
              <div className="flex flex-col gap-0.5 border-x border-border-custom/50">
                <span className="text-[9px] uppercase text-text-muted font-bold tracking-wider">Nifty Trend</span>
                <span className={`font-mono font-bold ${prediction.macroContext.niftyTrend === 'BULLISH' ? 'text-accent-green' : prediction.macroContext.niftyTrend === 'BEARISH' ? 'text-accent-red' : 'text-text-primary'}`}>
                  {prediction.macroContext.niftyTrend}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] uppercase text-text-muted font-bold tracking-wider">India VIX</span>
                <span className={`font-mono font-bold ${prediction.macroContext.vixLevel > 20 ? 'text-accent-red' : 'text-text-primary'}`}>
                  {prediction.macroContext.vixLevel.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Middle: Price Target Slider */}
        <div className="p-4 border border-border-custom bg-bg-secondary/10 rounded-xl">
          <PriceRangeBar
            currentPrice={currentPrice}
            targetLow={targetLow}
            targetHigh={targetHigh}
          />
        </div>

        {/* Bottom: Dynamic Interactive Explainability Breakdown */}
        {hasExplainability && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[9px] font-mono font-bold text-text-secondary uppercase tracking-wider">
                Normalized Indicator Contribution Breakdown
              </h3>
              <span className="text-[8px] font-mono bg-bg-secondary px-1.5 py-0.5 rounded border border-border-custom text-text-secondary">
                Normalized to 100%
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {explainabilityMetrics.map((m) => (
                <div key={m.label} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10.5px] font-mono font-semibold text-text-secondary">
                    <span>{m.label}</span>
                    <span className="text-text-primary">{m.val}%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-bg-secondary border border-border-custom rounded-full overflow-hidden transition-theme">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${m.color}`}
                      style={{ width: `${m.val}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom: AI Reasoning Summary Segment */}
        <div className="p-4 border border-border-custom bg-bg-secondary/20 rounded-xl space-y-1.5">
          <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
            <Info className="w-4 h-4 text-accent-blue" />
            AI Reasoning Summary
          </h4>
          <p className="text-xs text-text-secondary leading-relaxed font-sans">{prediction.explainability?.aiReasoningSummary || prediction.summary || summary}</p>
        </div>

      </div>
    </div>
  );
}
