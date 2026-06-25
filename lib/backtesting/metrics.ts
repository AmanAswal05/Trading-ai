import { BacktestTrade, EquityPoint, DrawdownPoint } from './types';

export function calculateMetrics(
  initialCapital: number,
  trades: BacktestTrade[],
  equityCurve: EquityPoint[]
) {
  const totalTrades = trades.length;
  if (totalTrades === 0) {
    return {
      winRate: 0,
      lossRate: 0,
      profitAndLoss: 0,
      cagr: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      averageWin: 0,
      averageLoss: 0,
      winLossRatio: 0,
      drawdownCurve: [],
    };
  }

  const wins = trades.filter(t => t.isWin);
  const losses = trades.filter(t => !t.isWin);

  const winRate = (wins.length / totalTrades) * 100;
  const lossRate = (losses.length / totalTrades) * 100;

  const totalWinAmount = wins.reduce((sum, t) => sum + t.profitAmount, 0);
  const totalLossAmount = losses.reduce((sum, t) => sum + Math.abs(t.profitAmount), 0);

  const averageWin = wins.length > 0 ? totalWinAmount / wins.length : 0;
  const averageLoss = losses.length > 0 ? totalLossAmount / losses.length : 0;
  const winLossRatio = averageLoss > 0 ? averageWin / averageLoss : averageWin > 0 ? 999 : 0;

  const finalEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : initialCapital;
  const profitAndLoss = finalEquity - initialCapital;

  // CAGR calculation
  let cagr = 0;
  if (equityCurve.length > 1) {
    const startDate = new Date(equityCurve[0].date);
    const endDate = new Date(equityCurve[equityCurve.length - 1].date);
    const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (years > 0) {
      cagr = (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100;
    }
  }

  // Drawdown calculation
  let peak = initialCapital;
  let maxDrawdown = 0;
  const drawdownCurve: DrawdownPoint[] = [];

  for (const point of equityCurve) {
    if (point.equity > peak) {
      peak = point.equity;
    }
    const drawdown = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
    drawdownCurve.push({
      date: point.date,
      drawdown: round(drawdown),
      underwater: drawdown > 0
    });
  }

  // Sharpe Ratio (Simplified, assuming 0% risk-free rate)
  let sharpeRatio = 0;
  if (trades.length > 1) {
    const returns = trades.map(t => t.returnPct / 100);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1));
    if (stdDev > 0) {
      // Annualize Sharpe based on ~252 trading days per year
      // Since trade lengths vary, an approximation is average return per trade * sqrt(number of trades per year)
      // Here we do a basic per-trade Sharpe approximation.
      sharpeRatio = (avgReturn / stdDev) * Math.sqrt(totalTrades); 
    }
  }

  return {
    winRate: round(winRate),
    lossRate: round(lossRate),
    profitAndLoss: round(profitAndLoss),
    cagr: round(cagr),
    maxDrawdown: round(maxDrawdown),
    sharpeRatio: round(sharpeRatio),
    averageWin: round(averageWin),
    averageLoss: round(averageLoss),
    winLossRatio: round(winLossRatio),
    drawdownCurve,
  };
}

function round(num: number): number {
  return Math.round(num * 100) / 100;
}
