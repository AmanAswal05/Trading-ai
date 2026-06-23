import { NextResponse } from 'next/server';
import { runDataQualityAudit, DataQualityReport } from '../../../lib/dataQualityAudit';

// Utility to generate mock data for the API response
function generateMockHistoricalData(minYear: number, maxYear: number): Record<string, any[]> {
  const tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'RELIANCE.BSE', 'TCS', 'HDFCBANK'];
  const data: Record<string, any[]> = {};
  
  for (const ticker of tickers) {
    data[ticker] = [];
    let currentPrice = 100 + Math.random() * 900;
    let change = 0;
    
    for (let year = minYear; year <= maxYear; year++) {
      for (let month = 1; month <= 12; month++) {
        for (let day = 1; day <= 28; day++) {
          const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          
          const momentum = change > 0 ? 0.02 : -0.01;
          change = (Math.random() - 0.48) * 0.05 + momentum;
          currentPrice = currentPrice * (1 + change);
          
          const openPrice = currentPrice * (1 - change/2);
          const highPrice = Math.max(openPrice, currentPrice) * 1.02;
          const lowPrice = Math.min(openPrice, currentPrice) * 0.98;
          
          data[ticker].push({
            date: dateStr,
            open: openPrice,
            high: highPrice,
            low: lowPrice,
            close: currentPrice,
            adjClose: currentPrice,
            volume: Math.floor(Math.random() * 10000000)
          });
        }
      }
    }
  }
  return data;
}

export async function GET() {
  try {
    // Generate base mock data
    const historicalData = generateMockHistoricalData(2022, 2024);

    // Inject data corruption for demonstration purposes
    if (historicalData['TCS']) {
      // Simulate extreme split (price halving)
      historicalData['TCS'][100].close /= 2;
      historicalData['TCS'][100].high /= 2;
      historicalData['TCS'][100].low /= 2;
      historicalData['TCS'][100].open /= 2;
      
      // Simulate duplicate timestamp
      historicalData['TCS'][120].date = historicalData['TCS'][119].date;
    }

    if (historicalData['HDFCBANK']) {
      // Missing values
      historicalData['HDFCBANK'][50].close = NaN;
      // Impossible candle (High < Low)
      historicalData['HDFCBANK'][55].high = historicalData['HDFCBANK'][55].low - 10;
      // Invalid volume
      historicalData['HDFCBANK'][60].volume = -500;
      // Simulate a missing candle gap (by dropping 10 days)
      historicalData['HDFCBANK'].splice(70, 10);
    }
    
    if (historicalData['RELIANCE.BSE']) {
        // Dividend drop 
        historicalData['RELIANCE.BSE'][140].close = historicalData['RELIANCE.BSE'][139].close * 0.85;
    }

    const reports: DataQualityReport[] = [];
    let totalScore = 0;

    for (const [ticker, bars] of Object.entries(historicalData)) {
      const report = runDataQualityAudit(ticker, bars as any);
      reports.push(report);
      totalScore += report.qualityScore;
    }

    const averageScore = totalScore / reports.length;

    return NextResponse.json({
      averageScore,
      reports
    });

  } catch (error) {
    console.error("Error generating data quality report:", error);
    return NextResponse.json({ error: "Failed to run data quality audit" }, { status: 500 });
  }
}
