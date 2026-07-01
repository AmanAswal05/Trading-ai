import { GET } from './app/api/scanner/route';

async function test() {
  const res = await GET();
  const data = await res.json();
  
  if (!data || data.length === 0) {
    console.log("No data returned");
    return;
  }

  let maxScore = -1;
  let maxTicker = '';
  let minScore = 101;
  let minTicker = '';
  let sumScore = 0;
  
  let above70 = 0;
  let between50and70 = 0;
  let below50 = 0;

  for (const item of data) {
    const opp = item.opportunityScore;
    sumScore += opp;
    
    if (opp > maxScore) {
      maxScore = opp;
      maxTicker = item.ticker;
    }
    
    if (opp < minScore) {
      minScore = opp;
      minTicker = item.ticker;
    }
    
    if (opp > 70) above70++;
    else if (opp >= 50) between50and70++;
    else below50++;
  }

  const avg = sumScore / data.length;

  console.log("=== METRICS ===");
  console.log("1. Highest opportunity score ticker:", maxTicker, "with score", maxScore);
  console.log("2. Lowest opportunity score ticker:", minTicker, "with score", minScore);
  console.log("3. Average opportunity score:", avg.toFixed(2));
  console.log("4. Number of tickers above 70:", above70);
  console.log("5. Number of tickers between 50 and 70:", between50and70);
  console.log("6. Number of tickers below 50:", below50);
}

test().catch(console.error);
