// ─── Stress Test Scenario Definitions ────────────────────────────────────────

import { StressScenario, StressScenarioKey } from './types';

/**
 * Historical crisis periods for stress testing the prediction engine.
 * All date ranges are based on peak-to-trough or event-defined windows.
 */
export const STRESS_SCENARIOS: Record<StressScenarioKey, StressScenario> = {
  DOT_COM_CRASH: {
    key: 'DOT_COM_CRASH',
    name: 'Dot-com Crash (2000–2002)',
    startDate: '2000-03-10',
    endDate: '2002-10-09',
    description: 'NASDAQ 100 fell ~78% from peak. Technology stocks collapsed following the internet bubble burst.',
    expectedRegime: 'BEAR',
    historicalSPReturn: -49.1, // S&P 500 peak-to-trough
  },

  FINANCIAL_CRISIS_2008: {
    key: 'FINANCIAL_CRISIS_2008',
    name: '2008 Financial Crisis',
    startDate: '2007-10-09',
    endDate: '2009-03-09',
    description: 'S&P 500 fell ~57%. Global financial system near-collapse triggered by subprime mortgage crisis.',
    expectedRegime: 'BEAR',
    historicalSPReturn: -56.8,
  },

  COVID_CRASH: {
    key: 'COVID_CRASH',
    name: 'COVID-19 Crash (2020)',
    startDate: '2020-02-19',
    endDate: '2020-03-23',
    description: 'Fastest 30%+ market drop in history. S&P 500 fell ~34% in 33 days as COVID-19 spread globally.',
    expectedRegime: 'HIGH_VOLATILITY',
    historicalSPReturn: -33.9,
  },

  HIGH_INFLATION: {
    key: 'HIGH_INFLATION',
    name: 'High Inflation Period (2021–2023)',
    startDate: '2021-11-01',
    endDate: '2023-06-30',
    description: 'Post-COVID inflation surge reaching 40-year highs of 9.1% CPI. Mixed signals in equity markets.',
    expectedRegime: 'HIGH_VOLATILITY',
    historicalSPReturn: -15.2,
  },

  RATE_HIKING: {
    key: 'RATE_HIKING',
    name: 'Fed Rate Hiking Cycle (2022–2023)',
    startDate: '2022-03-16',
    endDate: '2023-07-26',
    description: '11 consecutive rate hikes totaling 525bps. Most aggressive tightening cycle in 40 years.',
    expectedRegime: 'BEAR',
    historicalSPReturn: -18.1,
  },

  EXTREME_VOLATILITY: {
    key: 'EXTREME_VOLATILITY',
    name: 'Extreme Volatility Period (Feb–Apr 2020)',
    startDate: '2020-02-01',
    endDate: '2020-04-30',
    description: 'VIX reached 82.69 (highest ever). Includes both the COVID crash and initial recovery. Tests model behavior in extreme vol.',
    expectedRegime: 'HIGH_VOLATILITY',
    historicalSPReturn: -12.5, // Net for the period including recovery
  },
};

export function getScenario(key: StressScenarioKey): StressScenario {
  return STRESS_SCENARIOS[key];
}

export function getAllScenarios(): StressScenario[] {
  return Object.values(STRESS_SCENARIOS);
}

export function getScenarioDateRange(key: StressScenarioKey): { startDate: string; endDate: string } {
  const s = STRESS_SCENARIOS[key];
  return { startDate: s.startDate, endDate: s.endDate };
}

/**
 * Determines which stress scenarios overlap with a given date range.
 * Useful for automatically annotating long-horizon backtests.
 */
export function getOverlappingScenarios(startDate: string, endDate: string): StressScenario[] {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  return getAllScenarios().filter(s => {
    const sStart = new Date(s.startDate).getTime();
    const sEnd = new Date(s.endDate).getTime();
    // Overlap if start < scenarioEnd AND end > scenarioStart
    return start < sEnd && end > sStart;
  });
}

/**
 * Returns the scenario label for a given date (for annotating charts).
 */
export function getScenarioForDate(date: string): StressScenario | null {
  const ts = new Date(date).getTime();
  for (const scenario of getAllScenarios()) {
    const sStart = new Date(scenario.startDate).getTime();
    const sEnd = new Date(scenario.endDate).getTime();
    if (ts >= sStart && ts <= sEnd) return scenario;
  }
  return null;
}
