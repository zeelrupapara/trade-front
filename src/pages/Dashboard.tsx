import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import MarketWatch from '../components/MarketWatch/MarketWatch';
import TradingViewChart from '../components/TradingChart/TradingViewChart';
import { websocketService } from '../services/websocket';
import { useMarketStore } from '../stores/marketStore';
import { marketWatchService } from '../services/marketWatch';
import { DEFAULT_SYMBOLS } from '../utils/defaultSymbols';
import { ChartErrorBoundary } from '../components/ErrorBoundary';

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthStore();
  const { setConnected } = useMarketStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      // Fetch initial market watch symbols with detailed data
      marketWatchService.getWatchlistDetailed().then((response) => {
        
        if (response.symbols && response.symbols.length > 0) {
          // Update watchlist with symbol names
          const symbolNames = response.symbols.map(s => s.symbol);
          useMarketStore.getState().setWatchlist(symbolNames);
          
          // Mark that user has configured their watchlist
          localStorage.setItem('has_configured_watchlist', 'true');
          
          // Update symbol data with initial prices including Enigma and sync status
          response.symbols.forEach(symbolData => {
            useMarketStore.getState().updateSymbolData({
              symbol: symbolData.symbol,
              description: symbolData.name || symbolData.symbol,
              exchange: '',
              currency: 'USD',
              bid: symbolData.bid || 0,
              ask: symbolData.ask || 0,
              last: symbolData.price || symbolData.last || 0,
              price: symbolData.price || symbolData.last || 0,
              high: symbolData.high || 0,
              low: symbolData.low || 0,
              change: symbolData.change || 0,
              changePercent: symbolData.changePercent || 0,
              volume: symbolData.volume || 0,
              timestamp: symbolData.timestamp || Date.now(),
              sync_status: symbolData.sync_status || 'pending',
              sync_progress: symbolData.sync_progress || 0,
              enigma: symbolData.enigma || undefined
            });
            
            // Cache ATH/ATL data for dynamic calculation
            if (symbolData.enigma) {
              import('../utils/enigmaCalculator').then(({ cacheEnigmaData }) => {
                cacheEnigmaData(
                  symbolData.symbol,
                  symbolData.enigma!.ath,
                  symbolData.enigma!.atl,
                  symbolData.enigma!.asset_class
                );
              });
            }
          });
        } else {
          // Check if user needs default symbols (first time user)
          // This could be improved by having the backend indicate if user is new
          const hasHadWatchlist = localStorage.getItem('has_configured_watchlist');
          
          if (!hasHadWatchlist) {
            // First time user - set up default symbols
            useMarketStore.getState().setWatchlist(DEFAULT_SYMBOLS);
            
            // Add default symbols to user's watchlist
            DEFAULT_SYMBOLS.forEach(symbol => {
              marketWatchService.addSymbol(symbol).catch(() => {});
            });
            
            // Mark that user has had a watchlist configured
            localStorage.setItem('has_configured_watchlist', 'true');
          } else {
            // Existing user with empty watchlist - respect their choice
            useMarketStore.getState().setWatchlist([]);
          }
        }
      });
      
      // WebSocket connection is handled by WebSocketProvider in App.tsx
      // Set up message handlers and store their cleanup functions
      const cleanupFunctions: Array<() => void> = [];

      // Handle market watch symbols response
      const unsubMarketWatch = websocketService.onMessage('market_watch_subscribe', (message) => {
        if (message.data && message.data.symbols && message.data.symbols.length > 0) {
          // Update the watchlist in store
          useMarketStore.getState().setWatchlist(message.data.symbols);
          // Backend auto-subscribes based on session, no manual subscription needed
        }
      });
      cleanupFunctions.push(unsubMarketWatch);

      // Handle price updates (backend sends 'price' type via binary protocol)
      const unsubPrice = websocketService.onMessage('price', (message) => {
        const priceData = message.data;
        if (priceData && priceData.symbol) {
          // DEBUG: Log raw price data to see what we're receiving
          console.log('Raw price data from WebSocket:', {
            symbol: priceData.symbol,
            change24h: priceData.change24h,
            changePercent: priceData.changePercent,
            open24h: priceData.open24h,
            price: priceData.price
          });
          
          // Transform binary protocol data to include 24hr change fields
          const marketData = {
            symbol: priceData.symbol,
            bid: priceData.bid,
            ask: priceData.ask,
            last: priceData.price,
            price: priceData.price,
            volume: priceData.volume,
            timestamp: priceData.timestamp,
            // Include 24hr change data from backend
            change: priceData.change24h || 0,
            changePercent: priceData.changePercent || 0,
            high: priceData.high24h,
            low: priceData.low24h,
            open: priceData.open24h
          };
          
          console.log('Transformed market data:', {
            symbol: marketData.symbol,
            change: marketData.change,
            changePercent: marketData.changePercent
          });
          
          useMarketStore.getState().updatePrice(marketData);
          
          // Calculate dynamic Enigma level if we have cached ATH/ATL
          import('../utils/enigmaCalculator').then(({ calculateEnigmaLevelForSymbol, getCachedEnigmaData }) => {
            const cached = getCachedEnigmaData(priceData.symbol);
            if (cached && priceData.price) {
              const dynamicLevel = calculateEnigmaLevelForSymbol(priceData.symbol, priceData.price);
              if (dynamicLevel !== null) {
                // Update Enigma level in store with dynamic calculation
                useMarketStore.getState().updateEnigmaData({
                  symbol: priceData.symbol,
                  level: dynamicLevel,
                  ath: cached.ath,
                  atl: cached.atl,
                  asset_class: cached.assetClass,
                  timestamp: new Date().toISOString()
                });
              }
            }
          });
        }
      });
      cleanupFunctions.push(unsubPrice);

      // Handle price_update (alternative event name)
      const unsubPriceUpdate = websocketService.onMessage('price_update', (message) => {
        const priceData = message.data;
        if (priceData && priceData.symbol) {
          // Transform binary protocol data to include 24hr change fields
          const marketData = {
            symbol: priceData.symbol,
            bid: priceData.bid,
            ask: priceData.ask,
            last: priceData.price,
            price: priceData.price,
            volume: priceData.volume,
            timestamp: priceData.timestamp,
            // Include 24hr change data from backend
            change: priceData.change24h || 0,
            changePercent: priceData.changePercent || 0,
            high: priceData.high24h,
            low: priceData.low24h,
            open: priceData.open24h
          };
          useMarketStore.getState().updatePrice(marketData);
        }
      });
      cleanupFunctions.push(unsubPriceUpdate);

      // Handle Enigma updates
      const unsubEnigma = websocketService.onMessage('enigma_update', (message) => {
        const enigmaData = message.data;
        if (enigmaData && enigmaData.symbol) {
          console.log('Enigma update received:', {
            symbol: enigmaData.symbol,
            level: enigmaData.level,
            ath: enigmaData.ath,
            atl: enigmaData.atl,
            asset_class: enigmaData.asset_class
          });
          
          // Cache ATH/ATL for dynamic calculations
          if (enigmaData.ath && enigmaData.atl) {
            import('../utils/enigmaCalculator').then(({ cacheEnigmaData }) => {
              cacheEnigmaData(
                enigmaData.symbol,
                enigmaData.ath,
                enigmaData.atl,
                enigmaData.asset_class
              );
            });
          }
          
          // Use the updateEnigmaData method from the store
          useMarketStore.getState().updateEnigmaData(enigmaData);
        }
      });
      cleanupFunctions.push(unsubEnigma);

      // Handle sync progress updates
      const unsubSyncProgress = websocketService.onMessage('sync_progress', (message) => {
        const syncData = message.data;
        if (syncData && syncData.symbol) {
          const currentSymbol = useMarketStore.getState().symbols.get(syncData.symbol);
          if (currentSymbol) {
            // Progress is already a percentage from backend (0-100)
            useMarketStore.getState().updateSymbolData({
              ...currentSymbol,
              sync_status: syncData.status || 'syncing',
              sync_progress: syncData.progress || 0
            });
          }
        }
      });
      cleanupFunctions.push(unsubSyncProgress);

      // Handle sync complete
      const unsubSyncComplete = websocketService.onMessage('sync_complete', (message) => {
        const syncData = message.data;
        if (syncData && syncData.symbol) {
          const currentSymbol = useMarketStore.getState().symbols.get(syncData.symbol);
          if (currentSymbol) {
            useMarketStore.getState().updateSymbolData({
              ...currentSymbol,
              sync_status: 'completed',
              sync_progress: 100
            });
          }
        }
      });
      cleanupFunctions.push(unsubSyncComplete);

      // Handle sync error
      const unsubSyncError = websocketService.onMessage('sync_error', (message) => {
        const syncData = message.data;
        if (syncData && syncData.symbol) {
          const currentSymbol = useMarketStore.getState().symbols.get(syncData.symbol);
          if (currentSymbol) {
            useMarketStore.getState().updateSymbolData({
              ...currentSymbol,
              sync_status: 'failed',
              sync_progress: 0
            });
          }
        }
      });
      cleanupFunctions.push(unsubSyncError);

      // Handle single symbol auto-subscribe
      const unsubAutoSubscribe = websocketService.onMessage('auto_subscribe', (message) => {
        if (message.data && message.data.symbol) {
          useMarketStore.getState().addToWatchlist(message.data.symbol);
        }
      });
      cleanupFunctions.push(unsubAutoSubscribe);

      // Handle single symbol auto-unsubscribe
      const unsubAutoUnsubscribe = websocketService.onMessage('auto_unsubscribe', (message) => {
        if (message.data && message.data.symbol) {
          useMarketStore.getState().removeFromWatchlist(message.data.symbol);
        }
      });
      cleanupFunctions.push(unsubAutoUnsubscribe);

      // Set initial connection status
      setConnected(websocketService.isConnected());

      // Register connection status handlers
      const unsubscribeConnect = websocketService.onConnect(() => {
        setConnected(true);
        // The backend will automatically subscribe to market watch symbols based on session
      });

      const unsubscribeDisconnect = websocketService.onDisconnect(() => {
        setConnected(false);
      });

      // Cleanup ALL handlers
      return () => {
        // Clean up all message handlers
        cleanupFunctions.forEach(cleanup => cleanup());
        // Clean up connection handlers
        unsubscribeConnect();
        unsubscribeDisconnect();
      };
    }
    
    // No cleanup needed for WebSocket lifecycle - it's managed by WebSocketProvider
  }, [isAuthenticated, setConnected]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-700">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50">
      <PanelGroup direction="horizontal" className="h-full">
        {/* TradingView Chart Panel - 75% */}
        <Panel defaultSize={75} minSize={50}>
          <div className="h-full bg-white border-r border-gray-200">
            <ChartErrorBoundary>
              <TradingViewChart />
            </ChartErrorBoundary>
          </div>
        </Panel>
        
        {/* Resize Handle */}
        <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors" />
        
        {/* Market Watch Panel - 25% */}
        <Panel defaultSize={25} minSize={15} maxSize={40}>
          <MarketWatch />
        </Panel>
      </PanelGroup>
    </div>
  );
}