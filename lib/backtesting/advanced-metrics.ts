import {
  BacktestTrade,
  EquityPoint,
  AdvancedAnalytics,
  OHLCVBar
} from './types';

export function calculateAdvancedAnalytics(
  initialCapital: number,
  trades: BacktestTrade[],
  equityCurve: EquityPoint[],
  ohlcvData: OHLCVBar[]
): AdvancedAnalytics {
  const defaultEmpty: AdvancedAnalytics = {
    profitFactor: 0,
    averageWinningTradePct: 0,
    averageWinningTradeAmount: 0,
    averageLosingTradePct: 0,
    averageLosingTradeAmount: 0,
    expectancyPct: 0,
    expectancyAmount: 0,
    largestWinningTrade: null,
    largestLosingTrade: null,
    maxConsecutiveWins: 0,
    maxConsecutiveLosses: 0,
    monthlyReturns: [],
    benchmark: {
      startingPrice: 0,
      endingPrice: 0,
      returnPct: 0,
      cagr: 0,
      maxDrawdown: 0,
      equityCurve: [],
      alpha: 0
    },
    tradeDuration: {
      averageDays: 0,
      shortestDays: 0,
      longestDays: 0,
      medianDays: 0,
      distribution: [
        { bucket: '0-7 days', count: 0 },
        { bucket: '8-30 days', count: 0 },
        { bucket: '31-90 days', count: 0 },
        { bucket: '90+ days', count: 0 }
      ]
    },
    annualPerformance: [],
    returnDistribution: [
      { bucket: '< -10%', count: 0 },
      { bucket: '-10% to -5%', count: 0 },
      { bucket: '-5% to 0%', count: 0 },
      { bucket: '0% to 5%', count: 0 },
      { bucket: '5% to 10%', count: 0 },
      { bucket: '> 10%', count: 0 }
    ],
    confidenceAnalysis: {
      available: false
    }
  };

  if (trades.length === 0 || ohlcvData.length === 0) {
    return defaultEmpty;
  }

  // --- Basics ---
  const wins = trades.filter(t => t.isWin);
  const losses = trades.filter(t => !t.isWin);

  const grossProfit = wins.reduce((sum, t) => sum + t.profitAmount, 0);
  const grossLoss = losses.reduce((sum, t) => sum + Math.abs(t.profitAmount), 0);
  
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 999 : 0) : grossProfit / grossLoss;

  const averageWinningTradeAmount = wins.length > 0 ? grossProfit / wins.length : 0;
  const averageLosingTradeAmount = losses.length > 0 ? grossLoss / losses.length : 0;
  
  const averageWinningTradePct = wins.length > 0 ? wins.reduce((sum, t) => sum + t.returnPct, 0) / wins.length : 0;
  const averageLosingTradePct = losses.length > 0 ? losses.reduce((sum, t) => sum + t.returnPct, 0) / losses.length : 0;

  const winRate = wins.length / trades.length;
  const lossRate = losses.length / trades.length;

  const expectancyAmount = (winRate * averageWinningTradeAmount) - (lossRate * averageLosingTradeAmount);
  const expectancyPct = (winRate * averageWinningTradePct) + (lossRate * averageLosingTradePct);

  // --- Extremes ---
  let largestWinningTrade = null;
  let largestLosingTrade = null;

  if (wins.length > 0) {
    const best = wins.reduce((prev, current) => (prev.profitAmount > current.profitAmount) ? prev : current);
    largestWinningTrade = {
      returnPct: round(best.returnPct),
      amount: round(best.profitAmount),
      date: best.exitDate,
      ticker: best.ticker
    };
  }

  if (losses.length > 0) {
    const worst = losses.reduce((prev, current) => (prev.profitAmount < current.profitAmount) ? prev : current);
    largestLosingTrade = {
      returnPct: round(worst.returnPct),
      amount: round(Math.abs(worst.profitAmount)),
      date: worst.exitDate,
      ticker: worst.ticker
    };
  }

  // --- Streaks ---
  let currentWinStreak = 0;
  let maxConsecutiveWins = 0;
  let currentLossStreak = 0;
  let maxConsecutiveLosses = 0;

  for (const trade of trades) {
    if (trade.isWin) {
      currentWinStreak++;
      if (currentWinStreak > maxConsecutiveWins) maxConsecutiveWins = currentWinStreak;
      currentLossStreak = 0;
    } else {
      currentLossStreak++;
      if (currentLossStreak > maxConsecutiveLosses) maxConsecutiveLosses = currentLossStreak;
      currentWinStreak = 0;
    }
  }

  // --- Trade Duration ---
  const durations = trades.map(t => {
    const d1 = new Date(t.date).getTime();
    const d2 = new Date(t.exitDate).getTime();
    return Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
  }).sort((a, b) => a - b);

  const totalDuration = durations.reduce((a, b) => a + b, 0);
  const averageDays = totalDuration / durations.length;
  const shortestDays = durations[0];
  const longestDays = durations[durations.length - 1];
  const medianDays = durations.length % 2 === 0
    ? (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2
    : durations[Math.floor(durations.length / 2)];

  const durationDistribution = [
    { bucket: '0-7 days', count: durations.filter(d => d <= 7).length },
    { bucket: '8-30 days', count: durations.filter(d => d > 7 && d <= 30).length },
    { bucket: '31-90 days', count: durations.filter(d => d > 30 && d <= 90).length },
    { bucket: '90+ days', count: durations.filter(d => d > 90).length }
  ];

  // --- Return Distribution ---
  const returnDistribution = [
    { bucket: '< -10%', count: trades.filter(t => t.returnPct < -10).length },
    { bucket: '-10% to -5%', count: trades.filter(t => t.returnPct >= -10 && t.returnPct < -5).length },
    { bucket: '-5% to 0%', count: trades.filter(t => t.returnPct >= -5 && t.returnPct < 0).length },
    { bucket: '0% to 5%', count: trades.filter(t => t.returnPct >= 0 && t.returnPct < 5).length },
    { bucket: '5% to 10%', count: trades.filter(t => t.returnPct >= 5 && t.returnPct < 10).length },
    { bucket: '> 10%', count: trades.filter(t => t.returnPct >= 10).length }
  ];

  // --- Confidence Analysis ---
  const hasConfidence = trades.some(t => t.confidence > 0);
  let confidenceBuckets: { range: string; winRate: number; avgReturn: number; count: number }[] = [];
  
  if (hasConfidence) {
    const buckets = [
      { min: 50, max: 60, label: '50-60%' },
      { min: 60, max: 70, label: '60-70%' },
      { min: 70, max: 80, label: '70-80%' },
      { min: 80, max: 90, label: '80-90%' },
      { min: 90, max: 101, label: '90-100%' }
    ];

    confidenceBuckets = buckets.map(b => {
      const bucketTrades = trades.filter(t => t.confidence >= b.min && t.confidence < b.max);
      if (bucketTrades.length === 0) return { range: b.label, winRate: 0, avgReturn: 0, count: 0 };
      
      const bucketWins = bucketTrades.filter(t => t.isWin).length;
      const bucketWinRate = (bucketWins / bucketTrades.length) * 100;
      const bucketReturn = bucketTrades.reduce((sum, t) => sum + t.returnPct, 0) / bucketTrades.length;
      
      return {
        range: b.label,
        winRate: round(bucketWinRate),
        avgReturn: round(bucketReturn),
        count: bucketTrades.length
      };
    });
  }

  // --- Benchmark ---
  // Buy and hold from first bar to last bar of the OHLCV provided to the engine.
  const startingPrice = ohlcvData[0].close;
  const endingPrice = ohlcvData[ohlcvData.length - 1].close;
  const benchmarkReturnPct = ((endingPrice - startingPrice) / startingPrice) * 100;
  
  let benchmarkCagr = 0;
  const startDate = new Date(ohlcvData[0].date);
  const endDate = new Date(ohlcvData[ohlcvData.length - 1].date);
  const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  
  if (years > 0) {
    benchmarkCagr = (Math.pow(endingPrice / startingPrice, 1 / years) - 1) * 100;
  }

  // Calculate Benchmark Equity Curve & Drawdown
  const benchmarkEquityCurve: EquityPoint[] = [];
  let benchPeak = initialCapital;
  let benchMaxDrawdown = 0;
  
  for (const bar of ohlcvData) {
    const factor = bar.close / startingPrice;
    const currentEq = initialCapital * factor;
    
    if (currentEq > benchPeak) {
      benchPeak = currentEq;
    }
    const dd = benchPeak > 0 ? ((benchPeak - currentEq) / benchPeak) * 100 : 0;
    if (dd > benchMaxDrawdown) {
      benchMaxDrawdown = dd;
    }
    
    benchmarkEquityCurve.push({
      date: bar.date,
      equity: round(currentEq),
      drawdown: round(dd)
    });
  }

  // Calculate Strategy CAGR for Alpha calculation
  const finalEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : initialCapital;
  let strategyCagr = 0;
  if (years > 0) {
    strategyCagr = (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100;
  }
  
  const alpha = strategyCagr - benchmarkCagr;

  // --- Monthly Returns Heatmap & Annual Performance ---
  const monthlyMap: Record<string, number> = {};
  const annualMap: Record<string, { startEquity: number; endEquity: number; trades: BacktestTrade[], maxDrawdown: number, peak: number }> = {};
  
  // To calculate monthly returns properly based on equity curve:
  // We need the equity at the end of each month.
  let prevMonthEquity = initialCapital;
  let currentMonthStr = equityCurve.length > 0 ? equityCurve[0].date.substring(0, 7) : ''; // YYYY-MM
  
  for (let i = 0; i < equityCurve.length; i++) {
    const pt = equityCurve[i];
    const monthStr = pt.date.substring(0, 7);
    const yearStr = pt.date.substring(0, 4);
    
    // Annual tracking init
    if (!annualMap[yearStr]) {
      annualMap[yearStr] = {
        startEquity: i === 0 ? initialCapital : equityCurve[i === 0 ? 0 : i-1].equity,
        endEquity: pt.equity,
        trades: [],
        maxDrawdown: 0,
        peak: i === 0 ? initialCapital : equityCurve[i === 0 ? 0 : i-1].equity
      };
    }
    
    annualMap[yearStr].endEquity = pt.equity;
    if (pt.equity > annualMap[yearStr].peak) {
      annualMap[yearStr].peak = pt.equity;
    }
    const yrDd = annualMap[yearStr].peak > 0 ? ((annualMap[yearStr].peak - pt.equity) / annualMap[yearStr].peak) * 100 : 0;
    if (yrDd > annualMap[yearStr].maxDrawdown) {
      annualMap[yearStr].maxDrawdown = yrDd;
    }
    
    // Month transition
    if (monthStr !== currentMonthStr) {
      // End of previous month
      const endOfMonthEquity = equityCurve[i - 1].equity;
      const monthlyReturn = ((endOfMonthEquity - prevMonthEquity) / prevMonthEquity) * 100;
      monthlyMap[currentMonthStr] = monthlyReturn;
      
      currentMonthStr = monthStr;
      prevMonthEquity = endOfMonthEquity;
    }
    
    // Last point
    if (i === equityCurve.length - 1) {
      const monthlyReturn = ((pt.equity - prevMonthEquity) / prevMonthEquity) * 100;
      monthlyMap[currentMonthStr] = monthlyReturn;
    }
  }

  // Populate Annual trades
  for (const trade of trades) {
    const yearStr = trade.exitDate.substring(0, 4);
    if (annualMap[yearStr]) {
      annualMap[yearStr].trades.push(trade);
    }
  }

  const monthlyReturns = Object.entries(monthlyMap).map(([ym, ret]) => {
    const [y, m] = ym.split('-');
    return {
      year: parseInt(y),
      month: parseInt(m),
      returnPct: round(ret)
    };
  });

  const annualPerformance = Object.entries(annualMap).map(([yearStr, data]) => {
    const yrWins = data.trades.filter(t => t.isWin).length;
    const yrTotal = data.trades.length;
    const yrWinRate = yrTotal > 0 ? (yrWins / yrTotal) * 100 : 0;
    const yrReturn = ((data.endEquity - data.startEquity) / data.startEquity) * 100;
    
    let best = 0;
    let worst = 0;
    if (yrTotal > 0) {
      best = Math.max(...data.trades.map(t => t.returnPct));
      worst = Math.min(...data.trades.map(t => t.returnPct));
    }

    return {
      year: parseInt(yearStr),
      totalTrades: yrTotal,
      winRate: round(yrWinRate),
      totalReturn: round(yrReturn),
      bestTrade: round(best),
      worstTrade: round(worst),
      maxDrawdown: round(data.maxDrawdown),
      endingEquity: round(data.endEquity)
    };
  });

  return {
    profitFactor: round(profitFactor),
    averageWinningTradePct: round(averageWinningTradePct),
    averageWinningTradeAmount: round(averageWinningTradeAmount),
    averageLosingTradePct: round(averageLosingTradePct),
    averageLosingTradeAmount: round(averageLosingTradeAmount),
    expectancyPct: round(expectancyPct),
    expectancyAmount: round(expectancyAmount),
    largestWinningTrade,
    largestLosingTrade,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    monthlyReturns,
    benchmark: {
      startingPrice: round(startingPrice),
      endingPrice: round(endingPrice),
      returnPct: round(benchmarkReturnPct),
      cagr: round(benchmarkCagr),
      maxDrawdown: round(benchMaxDrawdown),
      equityCurve: benchmarkEquityCurve,
      alpha: round(alpha)
    },
    tradeDuration: {
      averageDays: round(averageDays),
      shortestDays,
      longestDays,
      medianDays,
      distribution: durationDistribution
    },
    annualPerformance,
    returnDistribution,
    confidenceAnalysis: {
      available: hasConfidence,
      buckets: confidenceBuckets
    }
  };
}

function round(num: number): number {
  return Math.round(num * 100) / 100;
}
