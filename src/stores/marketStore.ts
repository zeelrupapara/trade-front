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
        // Calculate change
        const change = tick.last - existing.last;
        const changePercent = existing.last > 0 ? (change / existing.last) * 100 : 0;
        
        newSymbols.set(tick.symbol, {
          ...existing,
          bid: tick.bid,
          ask: tick.ask,
          last: tick.last,
          volume: tick.volume,
          timestamp: tick.timestamp,
          change,
          changePercent
        });
      } else {
        // Create new symbol data from tick
        newSymbols.set(tick.symbol, {
          symbol: tick.symbol,
          description: tick.symbol,
          exchange: '',
          currency: 'USD',
          bid: tick.bid,
          ask: tick.ask,
          last: tick.last,
          change: 0,
          changePercent: 0,
          volume: tick.volume,
          timestamp: tick.timestamp
        });
      }
      
      return { symbols: newSymbols };
    });
  },

  updatePrice: (data: any) => {
    // Handle various price update formats
    if (data.symbol && (data.bid !== undefined || data.ask !== undefined || data.last !== undefined)) {
      get().updateMarketTick({
        symbol: data.symbol,
        bid: data.bid || 0,
        ask: data.ask || 0,
        last: data.last || data.price || 0,
        volume: data.volume || 0,
        timestamp: data.timestamp || Date.now()
      });
    }
  },

  setConnected: (connected: boolean) => {
    set({ isConnected: connected });
  },

  subscribeToSymbol: (symbol: string) => {
    websocketService.subscribeToSymbol(symbol);
  },

  unsubscribeFromSymbol: (symbol: string) => {
    websocketService.unsubscribeFromSymbol(symbol);
  }
}));

