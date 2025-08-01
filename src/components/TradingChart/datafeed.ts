// TradingView Datafeed Implementation
import { websocketService } from '../../services/websocket';
import { useMarketStore } from '../../stores/marketStore';

const configurationData = {
  supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
  exchanges: [{
    value: 'CRYPTO',
    name: 'Crypto',
    desc: 'Cryptocurrency Exchange',
  }],
  symbols_types: [{
    name: 'crypto',
    value: 'crypto',
  }],
};

const lastBarsCache = new Map();
const subscribers = new Map();

// Helper function to convert resolution to milliseconds
function getResolutionInMs(resolution: string): number {
  const resolutionMap: { [key: string]: number } = {
    '1': 60 * 1000,
    '5': 5 * 60 * 1000,
    '15': 15 * 60 * 1000,
    '30': 30 * 60 * 1000,
    '60': 60 * 60 * 1000,
    '240': 4 * 60 * 60 * 1000,
    'D': 24 * 60 * 60 * 1000,
    'W': 7 * 24 * 60 * 60 * 1000,
    'M': 30 * 24 * 60 * 60 * 1000,
  };
  return resolutionMap[resolution] || 60 * 1000;
}

export default {
  onReady: (callback: any) => {
    setTimeout(() => callback(configurationData), 0);
  },

  searchSymbols: (userInput: string, exchange: string, symbolType: string, onResultReadyCallback: any) => {
    // For now, return empty array
    onResultReadyCallback([]);
  },

  resolveSymbol: (symbolName: string, onSymbolResolvedCallback: any, onResolveErrorCallback: any) => {
    
    const symbolInfo = {
      ticker: symbolName,
      name: symbolName,
      description: symbolName,
      type: 'crypto',
      session: '24x7',
      timezone: 'Etc/UTC',
      exchange: 'CRYPTO',
      minmov: 1,
      pricescale: 100000,
      has_intraday: true,
      has_no_volume: false,
      has_weekly_and_monthly: true,
      supported_resolutions: configurationData.supported_resolutions,
      volume_precision: 8,
      data_status: 'streaming',
    };
    
    setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
  },

  getBars: async (symbolInfo: any, resolution: string, periodParams: any, onHistoryCallback: any, onErrorCallback: any) => {
    
    try {
      const { from, to, firstDataRequest } = periodParams;
      
      // Convert resolution to API format
      const interval = resolution === 'D' ? '1d' : resolution + 'm';
      
      // Fetch historical data from backend
      const response = await fetch(`/api/v1/symbols/${symbolInfo.ticker}/bars?resolution=${interval}&from=${from}&to=${to}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch bars');
      }
      
      const data = await response.json();
      const bars = data.bars || [];
      
      if (firstDataRequest && bars.length > 0) {
        lastBarsCache.set(symbolInfo.ticker, bars[bars.length - 1]);
      }
      
      onHistoryCallback(bars, { noData: bars.length === 0 });
    } catch (error) {
      // Error handled silently
      onErrorCallback(error);
    }
  },

  subscribeBars: (symbolInfo: any, resolution: string, onRealtimeCallback: any, subscriberUID: string, onResetCacheNeededCallback: any) => {
    
    // Subscribe to the symbol for real-time updates
    websocketService.subscribeToSymbol(symbolInfo.ticker);
    
    // Store subscriber info
    subscribers.set(subscriberUID, {
      symbolInfo,
      resolution,
      callback: onRealtimeCallback
    });
    
    // Listen to price updates from the market store
    const unsubscribe = useMarketStore.subscribe((state) => {
      const symbolData = state.symbols.get(symbolInfo.ticker);
      if (symbolData) {
        const lastBar = lastBarsCache.get(symbolInfo.ticker);
        const price = symbolData.last;
        
        if (lastBar && price > 0) {
          const currentTime = Math.floor(Date.now() / 1000) * 1000;
          const lastBarTime = lastBar.time;
          const resolutionInMs = getResolutionInMs(resolution);
          
          // Check if we need to create a new bar
          if (currentTime - lastBarTime >= resolutionInMs) {
            // Create new bar
            const newBar = {
              time: currentTime,
              open: price,
              high: price,
              low: price,
              close: price,
              volume: symbolData.volume || 0,
            };
            onRealtimeCallback(newBar);
            lastBarsCache.set(symbolInfo.ticker, newBar);
          } else {
            // Update existing bar
            const updatedBar = {
              ...lastBar,
              high: Math.max(lastBar.high, price),
              low: Math.min(lastBar.low, price),
              close: price,
              volume: symbolData.volume || lastBar.volume,
            };
            onRealtimeCallback(updatedBar);
            lastBarsCache.set(symbolInfo.ticker, updatedBar);
          }
        }
      }
    });
    
    // Store unsubscribe function
    subscribers.set(subscriberUID, {
      ...subscribers.get(subscriberUID),
      unsubscribe
    });
  },

  unsubscribeBars: (subscriberUID: string) => {
    
    const subscriber = subscribers.get(subscriberUID);
    if (subscriber) {
      if (subscriber.unsubscribe) {
        subscriber.unsubscribe();
      }
      subscribers.delete(subscriberUID);
    }
  },

  getServerTime: (callback: any) => {
    callback(Math.floor(Date.now() / 1000));
  },
};