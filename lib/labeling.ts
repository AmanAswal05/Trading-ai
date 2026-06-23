export interface DirectionalThresholdInput {
  price: number;
  volatility?: number; // Representing daily percentage volatility (e.g. 0.02 for 2%)
  timeframeDays?: number;
}

/**
 * Returns a volatility-adjusted return threshold for labeling an outcome as UP/DOWN.
 *
 * This keeps the label tied to the instrument's recent movement scale.
 */
export function getDirectionalMoveThreshold(
  input: DirectionalThresholdInput,
  fallbackPercent: number = 0.01
): number {
  const price = Number.isFinite(input.price) && input.price > 0 ? input.price : 0;
  if (price <= 0) return fallbackPercent;

  const dailyVolatility = input.volatility && input.volatility > 0 ? input.volatility : 0.0;
  const timeframeDays = Math.max(1, input.timeframeDays ?? 7);

  // Approximate expected move grows with sqrt(time), but keep a floor/ceiling
  // so labels remain stable and not overly permissive.
  const horizonScale = Math.sqrt(timeframeDays);
  // Default expected move based on daily volatility
  const expectedMove = dailyVolatility > 0 ? dailyVolatility * horizonScale * 0.5 : fallbackPercent;
  
  const adaptiveThreshold = Math.max(
    0.006, // Floor of 0.6%
    Math.min(0.05, expectedMove) // Ceiling of 5%
  );

  return Number.isFinite(adaptiveThreshold) && adaptiveThreshold > 0
    ? adaptiveThreshold
    : fallbackPercent;
}

export function classifyDirectionalMove(
  currentPrice: number,
  futurePrice: number,
  input: DirectionalThresholdInput,
  fallbackPercent: number = 0.01
): 'UP' | 'DOWN' | 'NEUTRAL' {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !Number.isFinite(futurePrice)) {
    return 'NEUTRAL';
  }

  const threshold = getDirectionalMoveThreshold(input, fallbackPercent);
  const diff = (futurePrice - currentPrice) / currentPrice;

  if (diff > threshold) return 'UP';
  if (diff < -threshold) return 'DOWN';
  return 'NEUTRAL';
}
