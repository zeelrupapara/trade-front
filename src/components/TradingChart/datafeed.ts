// TradingView Datafeed Implementation
import { websocketService } from '../../services/websocket';
import { useMarketStore } from '../../stores/marketStore';
import { TV_CONFIG, RESOLUTION_TO_MS, MARKET_CONFIG } from '../../constants';
import { retryWithBackoff, validateResponse, DataError } from '../../utils/errors';
import { SESSION_STORAGE_KEY } from '../../services/auth';

const configurationData = {
  supported_resolutions: TV_CONFIG.SUPPORTED_RESOLUTIONS,
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

// Cache with automatic cleanup
class BarCache {
  private cache = new Map<string, any>();
  private lastCleanup = Date.now();
  
  set(key: string, value: any) {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
    });
    this.cleanupIfNeeded();
  }
  
  get(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if cache is expired
    if (Date.now() - entry.timestamp > MARKET_CONFIG.MAX_CACHE_AGE) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  private cleanupIfNeeded() {
    if (Date.now() - this.lastCleanup > MARKET_CONFIG.CACHE_CLEANUP_INTERVAL) {
      this.cleanup();
    }
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > MARKET_CONFIG.MAX_CACHE_AGE) {
        this.cache.delete(key);
      }
    }
    this.lastCleanup = now;
  }
  
  clear() {
    this.cache.clear();
  }
}

const lastBarsCache = new BarCache();
const subscribers = new Map();

// Helper function to validate bar data
function validateBar(bar: any): boolean {
  return (
    bar &&
    typeof bar.time === 'number' &&
    typeof bar.open === 'number' &&
    typeof bar.high === 'number' &&
    typeof bar.low === 'number' &&
    typeof bar.close === 'number' &&
    bar.open > 0 &&
    bar.high >= bar.low &&
    bar.high >= bar.open &&
    bar.high >= bar.close &&
    bar.low <= bar.open &&
    bar.low <= bar.close
  );
}

export default {
  onReady: (callback: any) => {
    setTimeout(() => callback(configurationData), 0);
  },

  searchSymbols: (_userInput: string, _exchange: string, _symbolType: string, onResultReadyCallback: any) => {
    // For now, return empty array
    onResultReadyCallback([]);
  },

  resolveSymbol: (symbolName: string, onSymbolResolvedCallback: any, _onResolveErrorCallback: any) => {
    
    const symbolInfo = {
      ticker: symbolName,
      name: symbolName,
      description: symbolName,
      type: 'crypto',
      session: '24x7',
      timezone: 'Asia/Calcutta', // Use IST timezone
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
    console.log('[Datafeed] getBars called:', {
      symbol: symbolInfo?.ticker,
      resolution,
      from: new Date(periodParams.from * 1000).toISOString(),
      to: new Date(periodParams.to * 1000).toISOString(),
      firstDataRequest: periodParams.firstDataRequest
    });
    
    try {
      // Validate inputs
      if (!symbolInfo?.ticker) {
        throw new DataError('Invalid symbol info');
      }
      
      const { from, to, firstDataRequest, countBack } = periodParams;
      
      // Convert resolution to API format
      const interval = resolution === 'D' ? '1d' : resolution === 'W' ? '1w' : resolution === 'M' ? '1M' : resolution + 'm';
      
      // Build request URL with proper parameters
      const params = new URLSearchParams({
        resolution: interval,
        from: from.toString(),
        to: to.toString(),
        ...(countBack && { limit: Math.min(countBack, TV_CONFIG.MAX_BARS_BACK).toString() })
      });
      
      // Fetch with retry logic
      const data = await retryWithBackoff(
        async () => {
          const response = await fetch(`/api/v1/symbols/${symbolInfo.ticker}/bars?${params}`, {
            method: 'GET',
            headers: {
              'X-Session-Token': localStorage.getItem(SESSION_STORAGE_KEY) || '',
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            if (response.status === 404) {
              return { bars: [] }; // Symbol has no data yet
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          return await response.json();
        },
        {
          maxAttempts: TV_CONFIG.DATAFEED_RETRY_ATTEMPTS,
          initialDelay: TV_CONFIG.DATAFEED_RETRY_DELAY,
          onRetry: (attempt, error) => {
            console.warn(`[Datafeed] Retry attempt ${attempt} for ${symbolInfo.ticker}:`, error.message);
          }
        }
      );
      
      // Validate response structure
      validateResponse(data, {
        required: ['bars'],
        types: { bars: 'object' }
      });
      
      // Process and validate bars
      const bars = Array.isArray(data.bars) ? data.bars : [];
      const validBars = bars
        .filter(validateBar)
        .sort((a: any, b: any) => a.time - b.time) // Ensure chronological order
        .map((bar: any) => ({
          time: bar.time, // Already in milliseconds from backend
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume || 0,
        }));
      
      if (bars.length !== validBars.length) {
        console.warn(`[Datafeed] Filtered out ${bars.length - validBars.length} invalid bars`);
      }
      
      // Cache the last bar for real-time updates
      if (firstDataRequest && validBars.length > 0) {
        const cacheKey = `${symbolInfo.ticker}_${resolution}`;
        lastBarsCache.set(cacheKey, validBars[validBars.length - 1]);
      }
      
      console.log(`[Datafeed] Returning ${validBars.length} bars for ${symbolInfo.ticker}`);
      onHistoryCallback(validBars, { noData: validBars.length === 0 });
      
    } catch (error) {
      console.error('[Datafeed] getBars error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load historical data';
      onErrorCallback(errorMessage);
    }
  },

  subscribeBars: (symbolInfo: any, resolution: string, onRealtimeCallback: any, subscriberUID: string, _onResetCacheNeededCallback: any) => {
    console.log('[Datafeed] subscribeBars:', symbolInfo.ticker, resolution, subscriberUID);
    
    // Clean up any existing subscription for this UID
    const existingSubscriber = subscribers.get(subscriberUID);
    if (existingSubscriber?.unsubscribe) {
      existingSubscriber.unsubscribe();
    }
    
    // Subscribe to the symbol for real-time updates
    websocketService.subscribeToSymbol(symbolInfo.ticker);
    
    const cacheKey = `${symbolInfo.ticker}_${resolution}`;
    
    // Create price update handler
    const handlePriceUpdate = (priceData: any) => {
      if (!priceData || priceData.symbol !== symbolInfo.ticker) return;
      
      const lastBar = lastBarsCache.get(cacheKey);
      const price = priceData.last || priceData.price;
      
      if (!price || price <= 0) return;
      
      const currentTime = Math.floor(Date.now() / 1000) * 1000;
      const resolutionInMs = RESOLUTION_TO_MS[resolution] || RESOLUTION_TO_MS['1'];
      
      if (!lastBar) {
        // Create initial bar if we don't have one
        const newBar = {
          time: Math.floor(currentTime / resolutionInMs) * resolutionInMs,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: priceData.volume || 0,
        };
        onRealtimeCallback(newBar);
        lastBarsCache.set(cacheKey, newBar);
        return;
      }
      
      // Calculate the current bar's start time
      const currentBarTime = Math.floor(currentTime / resolutionInMs) * resolutionInMs;
      const lastBarTime = Math.floor(lastBar.time / resolutionInMs) * resolutionInMs;
      
      if (currentBarTime > lastBarTime) {
        // Create new bar
        const newBar = {
          time: currentBarTime,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: priceData.volume || 0,
        };
        console.log('[Datafeed] New bar created:', new Date(currentBarTime).toISOString());
        onRealtimeCallback(newBar);
        lastBarsCache.set(cacheKey, newBar);
      } else {
        // Update existing bar
        const updatedBar = {
          ...lastBar,
          high: Math.max(lastBar.high, price),
          low: Math.min(lastBar.low, price),
          close: price,
          volume: priceData.volume || lastBar.volume,
        };
        onRealtimeCallback(updatedBar);
        lastBarsCache.set(cacheKey, updatedBar);
      }
    };
    
    // Subscribe to WebSocket price updates
    const unsubscribeWs = websocketService.onMessage('price', (message) => {
      handlePriceUpdate(message.data);
    });
    
    // Also subscribe to market store updates as backup
    const unsubscribeStore = useMarketStore.subscribe((state) => {
      const symbolData = state.symbols.get(symbolInfo.ticker);
      if (symbolData) {
        handlePriceUpdate({
          symbol: symbolInfo.ticker,
          price: symbolData.last,
          last: symbolData.last,
          bid: symbolData.bid,
          ask: symbolData.ask,
          volume: symbolData.volume,
        });
      }
    });
    
    // Store subscriber info with cleanup functions
    subscribers.set(subscriberUID, {
      symbolInfo,
      resolution,
      callback: onRealtimeCallback,
      unsubscribe: () => {
        unsubscribeWs();
        unsubscribeStore();
      }
    });
  },

  unsubscribeBars: (subscriberUID: string) => {
    console.log('[Datafeed] unsubscribeBars:', subscriberUID);
    
    const subscriber = subscribers.get(subscriberUID);
    if (subscriber) {
      // Call cleanup function
      if (subscriber.unsubscribe) {
        subscriber.unsubscribe();
      }
      
      // Check if any other subscribers are listening to this symbol
      const symbolInfo = subscriber.symbolInfo;
      let hasOtherSubscribers = false;
      
      for (const [uid, sub] of subscribers.entries()) {
        if (uid !== subscriberUID && sub.symbolInfo.ticker === symbolInfo.ticker) {
          hasOtherSubscribers = true;
          break;
        }
      }
      
      // Unsubscribe from WebSocket only if no other subscribers
      if (!hasOtherSubscribers) {
        websocketService.unsubscribeFromSymbol(symbolInfo.ticker);
      }
      
      subscribers.delete(subscriberUID);
    }
  },

  getServerTime: (callback: any) => {
    callback(Math.floor(Date.now() / 1000));
  },
  
  // Additional utility methods
  cleanup: () => {
    console.log('[Datafeed] Cleanup called');
    
    // Unsubscribe all active subscriptions
    for (const [_uid, subscriber] of subscribers.entries()) {
      if (subscriber.unsubscribe) {
        subscriber.unsubscribe();
      }
    }
    subscribers.clear();
    
    // Clear cache
    lastBarsCache.clear();
  }
};