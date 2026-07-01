import { GET } from './app/api/scanner/route';

async function test() {
  // Overwrite console.log to capture SR logs
  const originalLog = console.log;
  let srLogs: any[] = [];
  console.log = (...args) => {
    if (typeof args[0] === 'string' && args[0].startsWith('SR Debug:')) {
      srLogs.push(args[0]);
    }
  };

  const res = await GET();
  const data = await res.json();
  
  // Restore console.log
  console.log = originalLog;

  let usedSR = 0;
  let usedATR = 0;
  let bestRR = -1;
  let bestRRTicker = '';
  let invalidTickers: string[] = [];
  let maxBreakoutLevel = -1;

  for (const log of srLogs) {
    const parts = log.split('|').map((s: string) => s.trim());
    const ticker = parts[0].replace('SR Debug:', '').trim();
    const breakoutLevelStr = parts.find((p: string) => p.startsWith('breakoutLevel:'))?.split(':')[1]?.trim() || 'null';
    const usedFallbackATRStr = parts.find((p: string) => p.startsWith('usedFallbackATR:'))?.split(':')[1]?.trim();
    const rrStr = parts.find((p: string) => p.startsWith('RR:'))?.split(':')[1]?.trim();

    if (usedFallbackATRStr === 'true') {
      usedATR++;
    } else if (usedFallbackATRStr === 'false') {
      usedSR++;
    }

    if (breakoutLevelStr !== 'null') {
      const bl = parseFloat(breakoutLevelStr);
      if (bl > maxBreakoutLevel) {
        maxBreakoutLevel = bl;
      }
    }
    
    if (rrStr) {
      const rr = parseFloat(rrStr);
      if (rr > bestRR) {
        bestRR = rr;
        bestRRTicker = ticker;
      }
    }
  }

  for (const item of data) {
    if (!item.hasValidTradePlan) {
      invalidTickers.push(item.ticker);
    }
  }

  console.log("=== METRICS ===");
  console.log("1. How many rows used support/resistance levels:", usedSR);
  console.log("2. How many rows fell back to ATR:", usedATR);
  console.log("3. Which ticker has the best risk/reward:", bestRRTicker, "with RR:", bestRR.toFixed(2));
  console.log("4. Which ticker has invalid/null trade plan:", invalidTickers.join(', ') || "None");
  console.log("5. Highest breakoutLevel detected:", maxBreakoutLevel === -1 ? "None" : maxBreakoutLevel);
}

test().catch(console.error);
