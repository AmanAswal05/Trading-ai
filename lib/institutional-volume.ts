import { HistoricalQuote } from '@/types/stock';

export type VolumeClassification = 
  | 'INSTITUTIONAL_ACCUMULATION'
  | 'STRONG_BUYING'
  | 'HEALTHY_VOLUME'
  | 'NORMAL_VOLUME'
  | 'WEAK_VOLUME'
  | 'INSTITUTIONAL_DISTRIBUTION';

export interface VolumeResult {
  currentVolume: number;
  avgVolume10D: number;
  avgVolume20D: number;
  rvol: number;
  classification: VolumeClassification;
}

export function calculateVolumeIntelligence(history: HistoricalQuote[]): VolumeResult {
  if (!history || history.length < 20) {
    return {
      currentVolume: 0,
      avgVolume10D: 0,
      avgVolume20D: 0,
      rvol: 1,
      classification: 'NORMAL_VOLUME'
    };
  }

  // Ensure histories are sorted oldest to newest
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const current = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const currentVolume = current.volume || 0;

  let sum10 = 0;
  for (let i = sorted.length - 10; i < sorted.length; i++) {
    sum10 += sorted[i].volume || 0;
  }
  const avgVolume10D = sum10 / 10;

  let sum20 = 0;
  for (let i = sorted.length - 20; i < sorted.length; i++) {
    sum20 += sorted[i].volume || 0;
  }
  const avgVolume20D = sum20 / 20;

  const rvol = avgVolume20D > 0 ? currentVolume / avgVolume20D : 1;
  const isPriceDown = current.close < previous.close;

  let classification: VolumeClassification = 'NORMAL_VOLUME';

  if (isPriceDown && rvol > 2.0) {
    classification = 'INSTITUTIONAL_DISTRIBUTION';
  } else if (rvol >= 3.0) {
    classification = 'INSTITUTIONAL_ACCUMULATION';
  } else if (rvol >= 2.0) {
    classification = 'STRONG_BUYING';
  } else if (rvol >= 1.2) {
    classification = 'HEALTHY_VOLUME';
  } else if (rvol >= 0.8) {
    classification = 'NORMAL_VOLUME';
  } else {
    classification = 'WEAK_VOLUME';
  }

  return {
    currentVolume,
    avgVolume10D,
    avgVolume20D,
    rvol: Number(rvol.toFixed(2)),
    classification
  };
}
