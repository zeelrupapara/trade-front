import { SESSION_STORAGE_KEY } from './auth';

export interface MarketWatchSymbol {
  symbol: string;
  name?: string;
  price: number;
  bid: number;
  bidSize: number;
  ask: number;
  askSize: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
  change: number;
  changePercent: number;
  timestamp: number;
  lastUpdateTime: string;
}

export interface MarketWatchResponse {
  symbols: MarketWatchSymbol[];
  count: number;
  timestamp: number;
}

export const marketWatchService = { 

  async getWatchlistDetailed(): Promise<MarketWatchResponse> {
    try {
      const response = await fetch('/api/v1/marketwatch?detailed=true', {
        method: 'GET',
        headers: {
          'X-Session-Token': localStorage.getItem(SESSION_STORAGE_KEY) || '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch detailed market watch');
      }
      
      return await response.json();
    } catch (error) {
      // Error fetching detailed market watch
      return {
        symbols: [],
        count: 0,
        timestamp: Date.now() / 1000,
      };
    }
  },


  async addSymbol(symbol: string): Promise<void> {
    const response = await fetch('/api/v1/marketwatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': localStorage.getItem(SESSION_STORAGE_KEY) || '',
      },
      body: JSON.stringify({ symbol }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to add symbol');
    }
  },

  async removeSymbol(symbol: string): Promise<void> {
    const response = await fetch(`/api/v1/marketwatch/${symbol}`, {
      method: 'DELETE',
      headers: {
        'X-Session-Token': localStorage.getItem(SESSION_STORAGE_KEY) || '',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to remove symbol');
    }
  },
};