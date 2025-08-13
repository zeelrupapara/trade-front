/**
 * Client-side Enigma level calculator
 * Calculates the current Enigma level based on live price and ATH/ATL
 */

export interface EnigmaCache {
  symbol: string;
  ath: number;
  atl: number;
  assetClass?: string;
  lastUpdated: number;
}

// Cache for ATH/ATL values per symbol
const enigmaCache = new Map<string, EnigmaCache>();

/**
 * Calculate Enigma level (0-100%) based on current price
 * Formula: ((currentPrice - ATL) / (ATH - ATL)) * 100
 */
export function calculateEnigmaLevel(currentPrice: number, ath: number, atl: number): number {
  if (!currentPrice || !ath || !atl || ath <= atl) {
    return 0;
  }
  
  const range = ath - atl;
  if (range === 0) {
    return 0;
  }
  
  let level = ((currentPrice - atl) / range) * 100;
  
  // Ensure level is within bounds
  if (level < 0) level = 0;
  if (level > 100) level = 100;
  
  return level;
}

/**
 * Store ATH/ATL in cache for a symbol
 */
export function cacheEnigmaData(symbol: string, ath: number, atl: number, assetClass?: string): void {
  enigmaCache.set(symbol, {
    symbol,
    ath,
    atl,
    assetClass,
    lastUpdated: Date.now()
  });
}

/**
 * Get cached ATH/ATL for a symbol
 */
export function getCachedEnigmaData(symbol: string): EnigmaCache | undefined {
  return enigmaCache.get(symbol);
}

/**
 * Calculate Enigma level using cached data
 */
export function calculateEnigmaLevelForSymbol(symbol: string, currentPrice: number): number | null {
  const cached = enigmaCache.get(symbol);
  if (!cached) {
    return null;
  }
  
  return calculateEnigmaLevel(currentPrice, cached.ath, cached.atl);
}

/**
 * Clear cache for a symbol
 */
export function clearEnigmaCache(symbol?: string): void {
  if (symbol) {
    enigmaCache.delete(symbol);
  } else {
    enigmaCache.clear();
  }
}

/**
 * Get market sentiment based on Enigma level
 */
export function getEnigmaSentiment(level: number): string {
  if (level < 20) return 'Extremely Oversold';
  if (level < 30) return 'Oversold';
  if (level < 40) return 'Bearish';
  if (level < 60) return 'Neutral';
  if (level < 70) return 'Bullish';
  if (level < 80) return 'Overbought';
  return 'Extremely Overbought';
}

/**
 * Get color for Enigma level
 */
export function getEnigmaColor(level: number): string {
  if (level < 20) return '#ef4444';      // Red - Oversold
  if (level < 40) return '#f59e0b';      // Orange
  if (level < 60) return '#3b82f6';      // Blue - Neutral
  if (level < 80) return '#8b5cf6';      // Purple
  return '#10b981';                       // Green - Overbought
}

/**
 * Check if cache is stale (older than 1 hour)
 */
export function isEnigmaCacheStale(symbol: string): boolean {
  const cached = enigmaCache.get(symbol);
  if (!cached) return true;
  
  const ONE_HOUR = 60 * 60 * 1000;
  return (Date.now() - cached.lastUpdated) > ONE_HOUR;
}