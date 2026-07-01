export type SectorType = 
  | 'TECHNOLOGY'
  | 'BANKING'
  | 'CONSUMER'
  | 'ENERGY'
  | 'HEALTHCARE'
  | 'INDUSTRIAL'
  | 'IT'
  | 'AUTO'
  | 'PHARMA'
  | 'FMCG'
  | 'TELECOM'
  | 'METALS';

export type RegionType = 'US' | 'INDIA';

export const STOCK_SECTOR_MAP: Record<string, { sector: SectorType, region: RegionType }> = {
  // US TECH
  "AAPL": { sector: "TECHNOLOGY", region: "US" },
  "MSFT": { sector: "TECHNOLOGY", region: "US" },
  "GOOGL": { sector: "TECHNOLOGY", region: "US" },
  "META": { sector: "TECHNOLOGY", region: "US" },
  "NVDA": { sector: "TECHNOLOGY", region: "US" },
  "AMD": { sector: "TECHNOLOGY", region: "US" },
  "AVGO": { sector: "TECHNOLOGY", region: "US" },
  
  // US CONSUMER
  "AMZN": { sector: "CONSUMER", region: "US" },
  "TSLA": { sector: "CONSUMER", region: "US" },
  "NFLX": { sector: "CONSUMER", region: "US" },
  
  // US BANKING/FINANCE
  "JPM": { sector: "BANKING", region: "US" },
  "BAC": { sector: "BANKING", region: "US" },
  "GS": { sector: "BANKING", region: "US" },
  "MS": { sector: "BANKING", region: "US" },
  "V": { sector: "BANKING", region: "US" },

  // INDIA ENERGY / TELECOM
  "RELIANCE.BSE": { sector: "ENERGY", region: "INDIA" },
  "BHARTIARTL.BSE": { sector: "TELECOM", region: "INDIA" },
  
  // INDIA IT
  "TCS.BSE": { sector: "IT", region: "INDIA" },
  "INFY.BSE": { sector: "IT", region: "INDIA" },
  
  // INDIA BANKING
  "HDFCBANK.BSE": { sector: "BANKING", region: "INDIA" },
  "ICICIBANK.BSE": { sector: "BANKING", region: "INDIA" },
  "SBIN.BSE": { sector: "BANKING", region: "INDIA" },
  "AXISBANK.BSE": { sector: "BANKING", region: "INDIA" },
  "BAJFINANCE.BSE": { sector: "BANKING", region: "INDIA" },
  
  // INDIA INDUSTRIALS
  "LT.BSE": { sector: "INDUSTRIAL", region: "INDIA" },
  
  // INDIA CONSUMER/FMCG
  "ITC.BSE": { sector: "FMCG", region: "INDIA" },
  "HINDUNILVR.BSE": { sector: "FMCG", region: "INDIA" },
  "TITAN.BSE": { sector: "CONSUMER", region: "INDIA" },
  
  // INDIA AUTO
  "MARUTI.BSE": { sector: "AUTO", region: "INDIA" },
  
  // INDIA PHARMA
  "SUNPHARMA.BSE": { sector: "PHARMA", region: "INDIA" },
};

// Map each sector to its representative Yahoo Finance index
// Some indices (like ^CNXAUTO) might not be perfectly supported, but they usually work.
export const SECTOR_INDEX_MAP: Record<RegionType, Partial<Record<SectorType, string>>> = {
  US: {
    TECHNOLOGY: "XLK",
    BANKING: "XLF",
    CONSUMER: "XLY",
    ENERGY: "XLE",
    HEALTHCARE: "XLV",
    INDUSTRIAL: "XLI",
    METALS: "XME",
    PHARMA: "PPH"
  },
  INDIA: {
    BANKING: "^NSEBANK",
    IT: "^CNXIT",
    AUTO: "^CNXAUTO",
    PHARMA: "^CNXPHARMA",
    FMCG: "^CNXFMCG",
    METALS: "^CNXMETAL",
    ENERGY: "^CNXENERGY",
    INDUSTRIAL: "^CNXINFRA",
    TELECOM: "^CNXMEDIA", // Or ^CNXENERGY as proxy if media fails
    CONSUMER: "^CNXCONSUM" // Nifty India Consumption
  }
};

export const MARKET_INDEX_MAP: Record<RegionType, string> = {
  US: "SPY",
  INDIA: "^NSEI"
};

export function getSectorForStock(ticker: string): { sector: SectorType, region: RegionType } {
  // If it's explicitly in the map
  if (STOCK_SECTOR_MAP[ticker]) {
    return STOCK_SECTOR_MAP[ticker];
  }
  
  // Fallback heuristic based on suffix
  const isIndia = ticker.endsWith('.NS') || ticker.endsWith('.BSE') || ticker.endsWith('.BO');
  return {
    sector: "TECHNOLOGY", // Safe default
    region: isIndia ? "INDIA" : "US"
  };
}

export function getIndexForSector(sector: SectorType, region: RegionType): string | null {
  return SECTOR_INDEX_MAP[region][sector] || null;
}
