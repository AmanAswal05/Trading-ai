import { GET } from './app/api/scanner/route';

async function test() {
  const req = new Request('http://localhost:3000/api/scanner');
  const response = await GET();
  const data = await response.json();
  
  const results = data.results;
  
  let maxRR = 0;
  let minRR = 999;
  let srAccepted = 0;
  let srRejected = 0;
  let atrUsed = 0;
  let invalid = 0;
  let totalRR = 0;
  let rrCount = 0;
  const rrGt5: string[] = [];
  const rrLt15: string[] = [];
  
  const dist: Record<string, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INVALID: 0
  };
  
  for (const r of results) {
     if (r.tradePlanQuality) {
       dist[r.tradePlanQuality] = (dist[r.tradePlanQuality] || 0) + 1;
     }
     if (r.tradePlanSource === 'support_resistance') srAccepted++;
     if (r.tradePlanSource === 'atr_fallback') atrUsed++;
     if (r.tradePlanSource === 'invalid') invalid++;
     
     if (r.tradePlanSource === 'atr_fallback' && r.direction !== 'NEUTRAL') srRejected++;
     
     if (r.hasValidTradePlan && r.riskReward) {
        if (r.riskReward > maxRR) maxRR = r.riskReward;
        if (r.riskReward < minRR) minRR = r.riskReward;
        totalRR += r.riskReward;
        rrCount++;
     }
     
     if (r.riskReward > 5) rrGt5.push(r.ticker);
     if (r.riskReward !== null && r.riskReward > 0 && r.riskReward < 1.5) rrLt15.push(r.ticker);
  }
  
  console.log("=== METRICS ===");
  console.log("1. Highest RR remaining:", maxRR);
  console.log("2. Lowest valid RR remaining:", minRR === 999 ? "N/A" : minRR);
  console.log("3. Number of SR plans accepted:", srAccepted);
  console.log("4. Number of SR plans rejected:", srRejected);
  console.log("5. Number of ATR fallback plans used:", atrUsed);
  console.log("6. Number of invalid plans:", invalid);
  console.log("7. Average RR after filtering:", rrCount > 0 ? (totalRR / rrCount).toFixed(2) : "N/A");
  console.log("8. List all tickers with RR > 5:", rrGt5.join(', ') || "None");
  console.log("9. List all tickers with RR < 1.5:", rrLt15.join(', ') || "None");
  console.log("10. Distribution:", dist);
}

test();
