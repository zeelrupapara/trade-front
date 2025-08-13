import { create } from 'zustand';
import { websocketService, type SymbolData, type MarketTick } from '../services/websocket';

interface MarketState {
  symbols: Map<string, SymbolData>;
  watchlist: string[];
  selectedSymbol: string | null;
  isConnected: boolean;
  
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  setWatchlist: (symbols: string[]) => void;
  selectSymbol: (symbol: string) => void;
  updateSymbolData: (data: SymbolData) => void;
  updateMarketTick: (tick: MarketTick) => void;
  updatePrice: (data: any) => void;
  updateEnigmaData: (data: any) => void;
  setConnected: (connected: boolean) => void;
  subscribeToSymbol: (symbol: string) => void;
  unsubscribeFromSymbol: (symbol: string) => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  symbols: new Map(),
  watchlist: [],
  selectedSymbol: null,
  isConnected: false,

  addToWatchlist: (symbol: string) => {
    set((state) => {
      if (!state.watchlist.includes(symbol)) {
        const newWatchlist = [...state.watchlist, symbol];
        // Subscribe to real-time data
        get().subscribeToSymbol(symbol);
        return { watchlist: newWatchlist };
      }
      return state;
    });
  },

  removeFromWatchlist: (symbol: string) => {
    set((state) => {
      const newWatchlist = state.watchlist.filter(s => s !== symbol);
      // Unsubscribe from real-time data
      get().unsubscribeFromSymbol(symbol);
      return { watchlist: newWatchlist };
    });
  },

  setWatchlist: (symbols: string[]) => {
    set({ watchlist: symbols });
    // No need to manually subscribe - backend auto-subscribes based on session
  },

  selectSymbol: (symbol: string) => {
    set({ selectedSymbol: symbol });
  },

  updateSymbolData: (data: SymbolData) => {
    set((state) => {
      const newSymbols = new Map(state.symbols);
      newSymbols.set(data.symbol, data);
      return { symbols: newSymbols };
    });
  },

  updateMarketTick: (tick: MarketTick) => {
    set((state) => {
      const newSymbols = new Map(state.symbols);
      const existing = newSymbols.get(tick.symbol);
      
      if (existing) {
        // Use 24hr change data from backend
        newSymbols.set(tick.symbol, {
          ...existing,
          bid: tick.bid,
          ask: tick.ask,
          last: tick.last,
          volume: tick.volume,
          timestamp: tick.timestamp,
          // Use 24hr change data from backend if available
          change: tick.change24h || existing.change || 0,
          changePercent: tick.changePercent || existing.changePercent || 0,
          open24h: tick.open24h || existing.open24h,
          high24h: tick.high24h || existing.high24h,
          low24h: tick.low24h || existing.low24h
        });
      } else {
        // Create new symbol data from tick with 24hr data
        newSymbols.set(tick.symbol, {
          symbol: tick.symbol,
          description: tick.symbol,
          exchange: '',
          currency: 'USD',
          bid: tick.bid,
          ask: tick.ask,
          last: tick.last,
          change: tick.change24h || 0,
          changePercent: tick.changePercent || 0,
          volume: tick.volume,
          timestamp: tick.timestamp,
          open24h: tick.open24h,
          high24h: tick.high24h,
          low24h: tick.low24h
        });
      }
      
      return { symbols: newSymbols };
    });
  },

  updatePrice: (data: any) => {
    // Handle various price update formats
    if (data.symbol) {
      const state = get();
      const existing = state.symbols.get(data.symbol);
      
      // If we have change/changePercent in the data, update the full symbol data
      if (data.change !== undefined || data.changePercent !== undefined) {
        state.updateSymbolData({
          ...existing,
          symbol: data.symbol,
          description: existing?.description || data.symbol,
          exchange: existing?.exchange || '',
          currency: existing?.currency || 'USD',
          bid: data.bid !== undefined ? data.bid : (existing?.bid || 0),
          ask: data.ask !== undefined ? data.ask : (existing?.ask || 0),
          last: data.last !== undefined ? data.last : (data.price || existing?.last || 0),
          price: data.price !== undefined ? data.price : (data.last || existing?.price || 0),
          high: data.high !== undefined ? data.high : (existing?.high || 0),
          low: data.low !== undefined ? data.low : (existing?.low || 0),
          change: data.change !== undefined ? data.change : (existing?.change || 0),
          changePercent: data.changePercent !== undefined ? data.changePercent : (existing?.changePercent || 0),
          volume: data.volume !== undefined ? data.volume : (existing?.volume || 0),
          timestamp: data.timestamp || Date.now(),
          sync_status: existing?.sync_status,
          sync_progress: existing?.sync_progress,
          enigma: existing?.enigma
        });
      } else if (data.bid !== undefined || data.ask !== undefined || data.last !== undefined) {
        // Just update tick data, preserve change/changePercent
        get().updateMarketTick({
          symbol: data.symbol,
          bid: data.bid || existing?.bid || 0,
          ask: data.ask || existing?.ask || 0,
          last: data.last || data.price || existing?.last || 0,
          volume: data.volume || existing?.volume || 0,
          timestamp: data.timestamp || Date.now()
        });
      }
    }
  },

  setConnected: (connected: boolean) => {
    set({ isConnected: connected });
  },

  updateEnigmaData: (data: any) => {
    set((state) => {
      const newSymbols = new Map(state.symbols);
      const existing = newSymbols.get(data.symbol);
      
      if (existing) {
        // Update the enigma data for the symbol
        newSymbols.set(data.symbol, {
          ...existing,
          enigma: {
            symbol: data.symbol,
            level: data.level,
            ath: data.ath,
            atl: data.atl,
            asset_class: data.asset_class,
            data_source: data.data_source,
            fib_levels: data.fibLevels || data.fib_levels,
            timestamp: new Date(data.timestamp).toISOString()
          }
        });
      }
      
      return { symbols: newSymbols };
    });
  },

  subscribeToSymbol: (symbol: string) => {
    websocketService.subscribeToSymbol(symbol);
  },

  unsubscribeFromSymbol: (symbol: string) => {
    websocketService.unsubscribeFromSymbol(symbol);
  }
}));

