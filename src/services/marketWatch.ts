import { SESSION_STORAGE_KEY } from './auth';

export interface MarketWatchSymbol {
  symbol: string;
  name?: string;
  price: number;
  bid: number;
  bidSize?: number;
  ask: number;
  askSize?: number;
  open?: number;
  high?: number;
  low?: number;
  last?: number;
  volume: number;
  quoteVolume?: number;
  change: number;
  changePercent: number;
  timestamp: number;
  lastUpdateTime?: string;
  sync_status?: 'pending' | 'syncing' | 'completed' | 'failed';
  sync_progress?: number;
  enigma?: {
    symbol: string;
    level: number;
    ath: number;
    atl: number;
    fib_levels: {
      '0': number;
      '23.6': number;
      '38.2': number;
      '50': number;
      '61.8': number;
      '78.6': number;
      '100': number;
    };
    timestamp: string;
  };
}

export interface MarketWatchResponse {
  symbols: MarketWatchSymbol[];
  count: number;
  timestamp?: number; // Optional, as backend doesn't always provide it
}

export const marketWatchService = { 

  async getWatchlistDetailed(): Promise<MarketWatchResponse> {
    try {
      const token = localStorage.getItem(SESSION_STORAGE_KEY);
      console.log('Fetching watchlist with token:', token ? 'Token present' : 'No token');
      
      const response = await fetch('/api/v1/marketwatch?detailed=true', {
        method: 'GET',
        headers: {
          'X-Session-Token': token || '',
        },
      });
      
      console.log('Watchlist response status:', response.status);
      
      if (!response.ok) {
        throw new Error('Failed to fetch detailed market watch');
      }
      
      const data = await response.json();
      console.log('Watchlist data from backend:', data);
      
      // Add timestamp if not provided by backend
      if (!data.timestamp) {
        data.timestamp = Date.now() / 1000;
      }
      return data;
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
    const token = localStorage.getItem(SESSION_STORAGE_KEY);
    console.log('MarketWatch API - Adding symbol:', symbol);
    console.log('Using token:', token ? 'Token present' : 'No token');
    
    const response = await fetch('/api/v1/marketwatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': token || '',
      },
      body: JSON.stringify({ symbol }),
    });
    
    console.log('Add symbol response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Add symbol error response:', errorText);
      throw new Error(`Failed to add symbol: ${response.status} ${errorText}`);
    }
    
    try {
      const result = await response.json();
      console.log('Add symbol response:', result);
    } catch (err) {
      console.log('Response might not have JSON body');
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