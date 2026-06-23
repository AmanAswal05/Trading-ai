export interface AccuracyStats {
  totalCount?: number;
  overallModelAccuracy?: number;
  accuracy?: number;
  tradeableAccuracy?: number;
  filteredPredictionsCount?: number;
  noSignalCount?: number;
  winLossRatioAfterFiltering?: number;
  winLossRatio?: number;
  medianError?: number;
  medianErrorAfterFiltering?: number;
  brierScore?: number;
  targetAchieved?: boolean;
  tradeableCount?: number;
  tradeablePredictionsCount?: number;
  calibrationError?: number;
  integrityWarnings?: any[];
  accuracyTrend?: any[];
  correctCount?: number;
  partialCount?: number;
  incorrectCount?: number;
  neutralCount?: number;
  reliabilityCurve?: any[];
  accuracyByModel?: any[];
  confidenceCalibration?: any[];
  stockReliability?: any[];
  timeframeReliability?: any[];
  confidenceBucketPerformance?: any[];
  sectorReliability?: any[];
  accuracyByMarket?: any[];
  failureAnalysis?: any[];
  [key: string]: any;
}

export interface DashboardStats {
  totalUsers: number;
  activeTrials: number;
  paidUsers: number;
  conversionRate: number;
  totalRevenue: number;
}

export interface TickerVolume {
  ticker: string;
  volume: number;
}

export interface PaymentRecord {
  id: string;
  user_email: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  created_at: string;
}

export interface SubscriptionRecord {
  id: string;
  user_email: string;
  plan_name: string;
  billing_cycle: string;
  status: string;
  end_date: string;
}
