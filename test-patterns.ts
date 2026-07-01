import { GET } from './app/api/scanner/route';

async function test() {
  const res = await GET();
  const data = await res.json();
  
  const patterns: Record<string, number> = {};
  let strongest = { pattern: '', strength: 0 };
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;

  for (const item of data) {
    const pat = item.pattern;
    patterns[pat] = (patterns[pat] || 0) + 1;
    
    // Find strongest (using confidence or patternStrength, but item only has confidence)
    if (item.confidence > strongest.strength && pat !== "No Clear Pattern") {
      strongest = { pattern: pat, strength: item.confidence };
    }

    if (item.signalBias === "BULLISH") bullish++;
    else if (item.signalBias === "BEARISH") bearish++;
    else neutral++;
  }

  console.log("=== METRICS ===");
  console.log("Pattern Distribution:", JSON.stringify(patterns, null, 2));
  
  const mostCommon = Object.entries(patterns).sort((a, b) => b[1] - a[1])[0];
  console.log("Most Common Pattern:", mostCommon[0]);
  console.log("Strongest Detected Pattern:", strongest.pattern, "with confidence", strongest.strength);
  console.log("Bullish Patterns:", bullish);
  console.log("Bearish Patterns:", bearish);
  console.log("Neutral Patterns:", neutral);
}

test().catch(console.error);
