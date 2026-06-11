// ─── S&P 500 Stock Universe with GICS Sectors ─────────────────────────────────

import { StockInfo, GICSSector } from './types';

export const SP500_UNIVERSE: StockInfo[] = [
  // Information Technology
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Information Technology', industry: 'Technology Hardware', marketCap: 'LARGE' },
  { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Information Technology', industry: 'Software', marketCap: 'LARGE' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Information Technology', industry: 'Semiconductors', marketCap: 'LARGE' },
  { ticker: 'AVGO', name: 'Broadcom Inc.', sector: 'Information Technology', industry: 'Semiconductors', marketCap: 'LARGE' },
  { ticker: 'ORCL', name: 'Oracle Corporation', sector: 'Information Technology', industry: 'Software', marketCap: 'LARGE' },
  { ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Information Technology', industry: 'Semiconductors', marketCap: 'LARGE' },
  { ticker: 'QCOM', name: 'Qualcomm Incorporated', sector: 'Information Technology', industry: 'Semiconductors', marketCap: 'LARGE' },
  { ticker: 'INTC', name: 'Intel Corporation', sector: 'Information Technology', industry: 'Semiconductors', marketCap: 'LARGE' },
  { ticker: 'TXN', name: 'Texas Instruments', sector: 'Information Technology', industry: 'Semiconductors', marketCap: 'LARGE' },
  { ticker: 'CRM', name: 'Salesforce Inc.', sector: 'Information Technology', industry: 'Software', marketCap: 'LARGE' },
  { ticker: 'IBM', name: 'International Business Machines', sector: 'Information Technology', industry: 'IT Services', marketCap: 'LARGE' },
  { ticker: 'NOW', name: 'ServiceNow Inc.', sector: 'Information Technology', industry: 'Software', marketCap: 'LARGE' },
  { ticker: 'INTU', name: 'Intuit Inc.', sector: 'Information Technology', industry: 'Software', marketCap: 'LARGE' },
  { ticker: 'AMAT', name: 'Applied Materials', sector: 'Information Technology', industry: 'Semiconductor Equipment', marketCap: 'LARGE' },
  { ticker: 'MU', name: 'Micron Technology', sector: 'Information Technology', industry: 'Semiconductors', marketCap: 'LARGE' },
  { ticker: 'LRCX', name: 'Lam Research Corporation', sector: 'Information Technology', industry: 'Semiconductor Equipment', marketCap: 'LARGE' },
  { ticker: 'ADI', name: 'Analog Devices', sector: 'Information Technology', industry: 'Semiconductors', marketCap: 'LARGE' },
  { ticker: 'KLAC', name: 'KLA Corporation', sector: 'Information Technology', industry: 'Semiconductor Equipment', marketCap: 'LARGE' },
  { ticker: 'MRVL', name: 'Marvell Technology', sector: 'Information Technology', industry: 'Semiconductors', marketCap: 'LARGE' },
  { ticker: 'HPQ', name: 'HP Inc.', sector: 'Information Technology', industry: 'Technology Hardware', marketCap: 'LARGE' },

  // Health Care
  { ticker: 'LLY', name: 'Eli Lilly and Company', sector: 'Health Care', industry: 'Pharmaceuticals', marketCap: 'LARGE' },
  { ticker: 'UNH', name: 'UnitedHealth Group', sector: 'Health Care', industry: 'Managed Health Care', marketCap: 'LARGE' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Health Care', industry: 'Pharmaceuticals', marketCap: 'LARGE' },
  { ticker: 'ABBV', name: 'AbbVie Inc.', sector: 'Health Care', industry: 'Pharmaceuticals', marketCap: 'LARGE' },
  { ticker: 'MRK', name: 'Merck & Co.', sector: 'Health Care', industry: 'Pharmaceuticals', marketCap: 'LARGE' },
  { ticker: 'ABT', name: 'Abbott Laboratories', sector: 'Health Care', industry: 'Health Care Equipment', marketCap: 'LARGE' },
  { ticker: 'TMO', name: 'Thermo Fisher Scientific', sector: 'Health Care', industry: 'Life Sciences', marketCap: 'LARGE' },
  { ticker: 'AMGN', name: 'Amgen Inc.', sector: 'Health Care', industry: 'Biotechnology', marketCap: 'LARGE' },
  { ticker: 'PFE', name: 'Pfizer Inc.', sector: 'Health Care', industry: 'Pharmaceuticals', marketCap: 'LARGE' },
  { ticker: 'GILD', name: 'Gilead Sciences', sector: 'Health Care', industry: 'Biotechnology', marketCap: 'LARGE' },
  { ticker: 'CVS', name: 'CVS Health', sector: 'Health Care', industry: 'Health Care Services', marketCap: 'LARGE' },
  { ticker: 'ISRG', name: 'Intuitive Surgical', sector: 'Health Care', industry: 'Health Care Equipment', marketCap: 'LARGE' },
  { ticker: 'SYK', name: 'Stryker Corporation', sector: 'Health Care', industry: 'Health Care Equipment', marketCap: 'LARGE' },
  { ticker: 'MDT', name: 'Medtronic plc', sector: 'Health Care', industry: 'Health Care Equipment', marketCap: 'LARGE' },
  { ticker: 'REGN', name: 'Regeneron Pharmaceuticals', sector: 'Health Care', industry: 'Biotechnology', marketCap: 'LARGE' },

  // Financials
  { ticker: 'BRK-B', name: 'Berkshire Hathaway', sector: 'Financials', industry: 'Diversified Financial', marketCap: 'LARGE' },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financials', industry: 'Diversified Banks', marketCap: 'LARGE' },
  { ticker: 'BAC', name: 'Bank of America', sector: 'Financials', industry: 'Diversified Banks', marketCap: 'LARGE' },
  { ticker: 'WFC', name: 'Wells Fargo & Company', sector: 'Financials', industry: 'Diversified Banks', marketCap: 'LARGE' },
  { ticker: 'GS', name: 'Goldman Sachs Group', sector: 'Financials', industry: 'Investment Banking', marketCap: 'LARGE' },
  { ticker: 'MS', name: 'Morgan Stanley', sector: 'Financials', industry: 'Investment Banking', marketCap: 'LARGE' },
  { ticker: 'C', name: 'Citigroup Inc.', sector: 'Financials', industry: 'Diversified Banks', marketCap: 'LARGE' },
  { ticker: 'AXP', name: 'American Express', sector: 'Financials', industry: 'Consumer Finance', marketCap: 'LARGE' },
  { ticker: 'BLK', name: 'BlackRock Inc.', sector: 'Financials', industry: 'Asset Management', marketCap: 'LARGE' },
  { ticker: 'SPGI', name: 'S&P Global Inc.', sector: 'Financials', industry: 'Financial Data', marketCap: 'LARGE' },
  { ticker: 'COF', name: 'Capital One Financial', sector: 'Financials', industry: 'Consumer Finance', marketCap: 'LARGE' },
  { ticker: 'USB', name: 'U.S. Bancorp', sector: 'Financials', industry: 'Regional Banks', marketCap: 'LARGE' },
  { ticker: 'PGR', name: 'Progressive Corporation', sector: 'Financials', industry: 'Property & Casualty Insurance', marketCap: 'LARGE' },
  { ticker: 'CB', name: 'Chubb Limited', sector: 'Financials', industry: 'Property & Casualty Insurance', marketCap: 'LARGE' },
  { ticker: 'MCO', name: 'Moody\'s Corporation', sector: 'Financials', industry: 'Financial Data', marketCap: 'LARGE' },

  // Consumer Discretionary
  { ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary', industry: 'Broadline Retail', marketCap: 'LARGE' },
  { ticker: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary', industry: 'Automobile Manufacturers', marketCap: 'LARGE' },
  { ticker: 'HD', name: 'Home Depot Inc.', sector: 'Consumer Discretionary', industry: 'Home Improvement Retail', marketCap: 'LARGE' },
  { ticker: 'MCD', name: 'McDonald\'s Corporation', sector: 'Consumer Discretionary', industry: 'Restaurants', marketCap: 'LARGE' },
  { ticker: 'NKE', name: 'Nike Inc.', sector: 'Consumer Discretionary', industry: 'Footwear', marketCap: 'LARGE' },
  { ticker: 'LOW', name: 'Lowe\'s Companies', sector: 'Consumer Discretionary', industry: 'Home Improvement Retail', marketCap: 'LARGE' },
  { ticker: 'SBUX', name: 'Starbucks Corporation', sector: 'Consumer Discretionary', industry: 'Restaurants', marketCap: 'LARGE' },
  { ticker: 'TJX', name: 'TJX Companies', sector: 'Consumer Discretionary', industry: 'Apparel Retail', marketCap: 'LARGE' },
  { ticker: 'BKNG', name: 'Booking Holdings', sector: 'Consumer Discretionary', industry: 'Hotels & Resorts', marketCap: 'LARGE' },
  { ticker: 'GM', name: 'General Motors', sector: 'Consumer Discretionary', industry: 'Automobile Manufacturers', marketCap: 'LARGE' },
  { ticker: 'F', name: 'Ford Motor Company', sector: 'Consumer Discretionary', industry: 'Automobile Manufacturers', marketCap: 'LARGE' },
  { ticker: 'ABNB', name: 'Airbnb Inc.', sector: 'Consumer Discretionary', industry: 'Hotels & Resorts', marketCap: 'LARGE' },

  // Communication Services
  { ticker: 'GOOG', name: 'Alphabet Inc. (Class C)', sector: 'Communication Services', industry: 'Interactive Media', marketCap: 'LARGE' },
  { ticker: 'GOOGL', name: 'Alphabet Inc. (Class A)', sector: 'Communication Services', industry: 'Interactive Media', marketCap: 'LARGE' },
  { ticker: 'META', name: 'Meta Platforms Inc.', sector: 'Communication Services', industry: 'Interactive Media', marketCap: 'LARGE' },
  { ticker: 'NFLX', name: 'Netflix Inc.', sector: 'Communication Services', industry: 'Entertainment', marketCap: 'LARGE' },
  { ticker: 'DIS', name: 'Walt Disney Company', sector: 'Communication Services', industry: 'Entertainment', marketCap: 'LARGE' },
  { ticker: 'CMCSA', name: 'Comcast Corporation', sector: 'Communication Services', industry: 'Cable & Satellite', marketCap: 'LARGE' },
  { ticker: 'VZ', name: 'Verizon Communications', sector: 'Communication Services', industry: 'Telecom Services', marketCap: 'LARGE' },
  { ticker: 'T', name: 'AT&T Inc.', sector: 'Communication Services', industry: 'Telecom Services', marketCap: 'LARGE' },
  { ticker: 'SPOT', name: 'Spotify Technology', sector: 'Communication Services', industry: 'Entertainment', marketCap: 'LARGE' },
  { ticker: 'SNAP', name: 'Snap Inc.', sector: 'Communication Services', industry: 'Interactive Media', marketCap: 'MID' },

  // Industrials
  { ticker: 'GE', name: 'GE Aerospace', sector: 'Industrials', industry: 'Aerospace & Defense', marketCap: 'LARGE' },
  { ticker: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials', industry: 'Construction & Mining', marketCap: 'LARGE' },
  { ticker: 'RTX', name: 'RTX Corporation', sector: 'Industrials', industry: 'Aerospace & Defense', marketCap: 'LARGE' },
  { ticker: 'UPS', name: 'United Parcel Service', sector: 'Industrials', industry: 'Air Freight', marketCap: 'LARGE' },
  { ticker: 'HON', name: 'Honeywell International', sector: 'Industrials', industry: 'Industrial Conglomerates', marketCap: 'LARGE' },
  { ticker: 'BA', name: 'Boeing Company', sector: 'Industrials', industry: 'Aerospace & Defense', marketCap: 'LARGE' },
  { ticker: 'LMT', name: 'Lockheed Martin', sector: 'Industrials', industry: 'Aerospace & Defense', marketCap: 'LARGE' },
  { ticker: 'DE', name: 'Deere & Company', sector: 'Industrials', industry: 'Agricultural Equipment', marketCap: 'LARGE' },
  { ticker: 'MMM', name: '3M Company', sector: 'Industrials', industry: 'Industrial Conglomerates', marketCap: 'LARGE' },
  { ticker: 'FDX', name: 'FedEx Corporation', sector: 'Industrials', industry: 'Air Freight', marketCap: 'LARGE' },

  // Consumer Staples
  { ticker: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Staples', industry: 'Consumer Staples Merchandise Retail', marketCap: 'LARGE' },
  { ticker: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', industry: 'Household Products', marketCap: 'LARGE' },
  { ticker: 'COST', name: 'Costco Wholesale', sector: 'Consumer Staples', industry: 'Consumer Staples Merchandise Retail', marketCap: 'LARGE' },
  { ticker: 'KO', name: 'Coca-Cola Company', sector: 'Consumer Staples', industry: 'Soft Drinks', marketCap: 'LARGE' },
  { ticker: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer Staples', industry: 'Soft Drinks', marketCap: 'LARGE' },
  { ticker: 'PM', name: 'Philip Morris International', sector: 'Consumer Staples', industry: 'Tobacco', marketCap: 'LARGE' },
  { ticker: 'MO', name: 'Altria Group', sector: 'Consumer Staples', industry: 'Tobacco', marketCap: 'LARGE' },
  { ticker: 'MDLZ', name: 'Mondelez International', sector: 'Consumer Staples', industry: 'Packaged Foods', marketCap: 'LARGE' },
  { ticker: 'CL', name: 'Colgate-Palmolive', sector: 'Consumer Staples', industry: 'Household Products', marketCap: 'LARGE' },
  { ticker: 'GIS', name: 'General Mills', sector: 'Consumer Staples', industry: 'Packaged Foods', marketCap: 'LARGE' },

  // Energy
  { ticker: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy', industry: 'Integrated Oil & Gas', marketCap: 'LARGE' },
  { ticker: 'CVX', name: 'Chevron Corporation', sector: 'Energy', industry: 'Integrated Oil & Gas', marketCap: 'LARGE' },
  { ticker: 'COP', name: 'ConocoPhillips', sector: 'Energy', industry: 'Oil & Gas Exploration', marketCap: 'LARGE' },
  { ticker: 'EOG', name: 'EOG Resources', sector: 'Energy', industry: 'Oil & Gas Exploration', marketCap: 'LARGE' },
  { ticker: 'SLB', name: 'SLB (Schlumberger)', sector: 'Energy', industry: 'Oil & Gas Equipment', marketCap: 'LARGE' },
  { ticker: 'MPC', name: 'Marathon Petroleum', sector: 'Energy', industry: 'Oil & Gas Refining', marketCap: 'LARGE' },
  { ticker: 'PSX', name: 'Phillips 66', sector: 'Energy', industry: 'Oil & Gas Refining', marketCap: 'LARGE' },
  { ticker: 'OXY', name: 'Occidental Petroleum', sector: 'Energy', industry: 'Oil & Gas Exploration', marketCap: 'LARGE' },
  { ticker: 'HAL', name: 'Halliburton Company', sector: 'Energy', industry: 'Oil & Gas Equipment', marketCap: 'LARGE' },
  { ticker: 'KMI', name: 'Kinder Morgan', sector: 'Energy', industry: 'Oil & Gas Storage', marketCap: 'LARGE' },

  // Utilities
  { ticker: 'NEE', name: 'NextEra Energy', sector: 'Utilities', industry: 'Electric Utilities', marketCap: 'LARGE' },
  { ticker: 'SO', name: 'Southern Company', sector: 'Utilities', industry: 'Electric Utilities', marketCap: 'LARGE' },
  { ticker: 'DUK', name: 'Duke Energy Corporation', sector: 'Utilities', industry: 'Electric Utilities', marketCap: 'LARGE' },
  { ticker: 'AEP', name: 'American Electric Power', sector: 'Utilities', industry: 'Electric Utilities', marketCap: 'LARGE' },
  { ticker: 'EXC', name: 'Exelon Corporation', sector: 'Utilities', industry: 'Electric Utilities', marketCap: 'LARGE' },
  { ticker: 'D', name: 'Dominion Energy', sector: 'Utilities', industry: 'Electric Utilities', marketCap: 'LARGE' },
  { ticker: 'PCG', name: 'PG&E Corporation', sector: 'Utilities', industry: 'Electric Utilities', marketCap: 'LARGE' },

  // Real Estate
  { ticker: 'PLD', name: 'Prologis Inc.', sector: 'Real Estate', industry: 'Industrial REITs', marketCap: 'LARGE' },
  { ticker: 'AMT', name: 'American Tower Corporation', sector: 'Real Estate', industry: 'Specialized REITs', marketCap: 'LARGE' },
  { ticker: 'CCI', name: 'Crown Castle Inc.', sector: 'Real Estate', industry: 'Specialized REITs', marketCap: 'LARGE' },
  { ticker: 'EQIX', name: 'Equinix Inc.', sector: 'Real Estate', industry: 'Specialized REITs', marketCap: 'LARGE' },
  { ticker: 'SPG', name: 'Simon Property Group', sector: 'Real Estate', industry: 'Retail REITs', marketCap: 'LARGE' },
  { ticker: 'WELL', name: 'Welltower Inc.', sector: 'Real Estate', industry: 'Health Care REITs', marketCap: 'LARGE' },
  { ticker: 'DLR', name: 'Digital Realty Trust', sector: 'Real Estate', industry: 'Specialized REITs', marketCap: 'LARGE' },

  // Materials
  { ticker: 'LIN', name: 'Linde plc', sector: 'Materials', industry: 'Industrial Gases', marketCap: 'LARGE' },
  { ticker: 'APD', name: 'Air Products & Chemicals', sector: 'Materials', industry: 'Industrial Gases', marketCap: 'LARGE' },
  { ticker: 'SHW', name: 'Sherwin-Williams Company', sector: 'Materials', industry: 'Specialty Chemicals', marketCap: 'LARGE' },
  { ticker: 'FCX', name: 'Freeport-McMoRan Inc.', sector: 'Materials', industry: 'Copper', marketCap: 'LARGE' },
  { ticker: 'ECL', name: 'Ecolab Inc.', sector: 'Materials', industry: 'Specialty Chemicals', marketCap: 'LARGE' },
  { ticker: 'NEM', name: 'Newmont Corporation', sector: 'Materials', industry: 'Gold', marketCap: 'LARGE' },
  { ticker: 'NUE', name: 'Nucor Corporation', sector: 'Materials', industry: 'Steel', marketCap: 'LARGE' },
  { ticker: 'DOW', name: 'Dow Inc.', sector: 'Materials', industry: 'Commodity Chemicals', marketCap: 'LARGE' },
];

// ─── Universe Accessors ────────────────────────────────────────────────────────

export function getSP500Universe(): StockInfo[] {
  return SP500_UNIVERSE;
}

export function getTickersBySector(sector: string): StockInfo[] {
  return SP500_UNIVERSE.filter(s => s.sector === sector);
}

export function getTickersByTimeframe(years: number): StockInfo[] {
  // Stocks with sufficient history:
  // < 5 years: exclude recent IPOs
  // >= 20 years: only established large caps (pre-2005 IPOs)
  if (years <= 5) return SP500_UNIVERSE;
  if (years <= 10) return SP500_UNIVERSE.filter(s => !['ABNB', 'SNAP', 'SPOT'].includes(s.ticker));
  if (years <= 20) return SP500_UNIVERSE.filter(s => s.marketCap === 'LARGE' && !['ABNB', 'SNAP', 'SPOT', 'NVDA', 'AMD'].includes(s.ticker));
  // 20Y+: established blue chips only
  return SP500_UNIVERSE.filter(s =>
    ['AAPL', 'MSFT', 'GOOG', 'GOOGL', 'AMZN', 'META', 'JPM', 'BAC', 'WFC', 'GS', 'JNJ',
     'PG', 'KO', 'PEP', 'XOM', 'CVX', 'WMT', 'HD', 'MCD', 'INTC', 'IBM', 'GE', 'CAT',
     'HON', 'MMM', 'BA', 'LMT', 'ABT', 'MRK', 'PFE', 'AMGN', 'T', 'VZ', 'CMCSA',
     'DIS', 'C', 'MS', 'AXP', 'NEE', 'SO', 'DUK', 'NEM', 'FCX', 'LIN', 'SHW'].includes(s.ticker)
  );
}

export function getAllSectors(): string[] {
  return [...new Set(SP500_UNIVERSE.map(s => s.sector))].sort();
}

export function getSectorSummary(): { sector: string; count: number; tickers: string[] }[] {
  const sectors = getAllSectors();
  return sectors.map(sector => {
    const stocks = getTickersBySector(sector);
    return { sector, count: stocks.length, tickers: stocks.map(s => s.ticker) };
  });
}

export function getStockInfo(ticker: string): StockInfo | undefined {
  return SP500_UNIVERSE.find(s => s.ticker === ticker);
}

export function getStockSector(ticker: string): string {
  return getStockInfo(ticker)?.sector ?? 'Unknown';
}
