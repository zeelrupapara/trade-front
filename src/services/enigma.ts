import { SESSION_STORAGE_KEY } from './auth';

// Asset classification types
export type AssetClass = 'crypto' | 'forex' | 'stock' | 'commodity' | 'index';

// Enigma data interfaces
export interface FibonacciLevels {
  '0': number;      // ATL
  '23.6': number;
  '38.2': number;
  '50': number;
  '61.8': number;
  '78.6': number;
  '100': number;    // ATH
}

export interface EnigmaData {
  symbol: string;
  asset_class: AssetClass;
  levels: FibonacciLevels;
  current_level: number;
  ath: number;
  atl: number;
  timestamp: string;
}

export interface AssetExtreme {
  symbol: string;
  asset_class: AssetClass;
  ath: number;
  atl: number;
  ath_date?: string;
  atl_date?: string;
  data_source: string;
  last_updated: number;
}

export interface AssetInfo {
  symbol: string;
  normalized_symbol: string;
  asset_class: AssetClass;
  exchange: string;
  description: string;
}

export interface BatchEnigmaRequest {
  symbols: string[];
}

export interface CustomFibonacciRequest {
  high: number;
  low: number;
}

export interface CustomFibonacciResponse {
  high: number;
  low: number;
  range: number;
  levels: FibonacciLevels;
}

class EnigmaService {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem(SESSION_STORAGE_KEY);
    return {
      'Content-Type': 'application/json',
      'X-Session-Token': token || '',
    };
  }

  /**
   * Get Enigma Fibonacci levels for a symbol
   */
  async getEnigmaLevels(symbol: string): Promise<EnigmaData> {
    const response = await fetch(`/api/v1/enigma/${symbol}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Enigma levels: ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * Get all-time extremes for a symbol
   */
  async getExtremes(symbol: string): Promise<AssetExtreme> {
    const response = await fetch(`/api/v1/enigma/${symbol}/extremes`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch extremes: ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * Get asset classification info for a symbol
   */
  async getAssetInfo(symbol: string): Promise<AssetInfo> {
    const response = await fetch(`/api/v1/enigma/${symbol}/info`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch asset info: ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * Get Enigma levels for multiple symbols
   */
  async getBatchEnigma(symbols: string[]): Promise<Record<string, any>> {
    const response = await fetch('/api/v1/enigma/batch', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ symbols }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch batch Enigma: ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * Calculate custom Fibonacci levels
   */
  async calculateCustomFibonacci(high: number, low: number): Promise<CustomFibonacciResponse> {
    const response = await fetch('/api/v1/enigma/calculate', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ high, low }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to calculate Fibonacci: ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * Format Fibonacci level for display
   */
  formatLevel(level: string, value: number): string {
    const formattedValue = this.formatPrice(value);
    
    switch(level) {
      case '0':
        return `ATL (0%): ${formattedValue}`;
      case '100':
        return `ATH (100%): ${formattedValue}`;
      default:
        return `${level}%: ${formattedValue}`;
    }
  }

  /**
   * Format price based on value magnitude
   */
  formatPrice(price: number): string {
    if (price >= 1000) {
      return price.toFixed(2);
    } else if (price >= 1) {
      return price.toFixed(4);
    } else if (price >= 0.01) {
      return price.toFixed(6);
    } else {
      return price.toFixed(8);
    }
  }

  /**
   * Get color for Enigma level
   */
  getLevelColor(level: number): string {
    if (level < 20) return '#ef4444';      // Red - Oversold
    if (level < 40) return '#f59e0b';      // Orange
    if (level < 60) return '#3b82f6';      // Blue - Neutral
    if (level < 80) return '#8b5cf6';      // Purple
    return '#10b981';                       // Green - Overbought
  }

  /**
   * Get market sentiment based on Enigma level
   */
  getMarketSentiment(level: number): string {
    if (level < 20) return 'Extremely Oversold';
    if (level < 30) return 'Oversold';
    if (level < 40) return 'Bearish';
    if (level < 60) return 'Neutral';
    if (level < 70) return 'Bullish';
    if (level < 80) return 'Overbought';
    return 'Extremely Overbought';
  }

  /**
   * Get asset class icon
   */
  getAssetClassIcon(assetClass: AssetClass): string {
    switch(assetClass) {
      case 'crypto':
        return '₿';
      case 'forex':
        return '💱';
      case 'stock':
        return '📈';
      case 'commodity':
        return '🛢️';
      case 'index':
        return '📊';
      default:
        return '📉';
    }
  }

  /**
   * Get asset class display name
   */
  getAssetClassName(assetClass: AssetClass): string {
    switch(assetClass) {
      case 'crypto':
        return 'Cryptocurrency';
      case 'forex':
        return 'Forex Pair';
      case 'stock':
        return 'Stock';
      case 'commodity':
        return 'Commodity';
      case 'index':
        return 'Index';
      default:
        return 'Asset';
    }
  }
}

export const enigmaService = new EnigmaService();