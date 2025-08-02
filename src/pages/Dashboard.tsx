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
          
          // Update symbol data with initial prices
          response.symbols.forEach(symbolData => {
            useMarketStore.getState().updateSymbolData({
              symbol: symbolData.symbol,
              description: symbolData.name || symbolData.symbol,
              exchange: '',
              currency: 'USD',
              bid: symbolData.bid,
              ask: symbolData.ask,
              last: symbolData.price,
              change: symbolData.change,
              changePercent: symbolData.changePercent,
              volume: symbolData.volume,
              timestamp: symbolData.timestamp
            });
          });
        } else {
          // Use default symbols if user has no watchlist
          useMarketStore.getState().setWatchlist(DEFAULT_SYMBOLS);
          
          // Add default symbols to user's watchlist
          DEFAULT_SYMBOLS.forEach(symbol => {
            marketWatchService.addSymbol(symbol).catch(() => {});
          });
        }
      });
      
      // WebSocket connection is handled by WebSocketProvider in App.tsx
      // Just set up message handlers here

      // Handle market watch symbols response
      websocketService.onMessage('market_watch_subscribe', (message) => {
        if (message.data && message.data.symbols && message.data.symbols.length > 0) {
          // Update the watchlist in store
          useMarketStore.getState().setWatchlist(message.data.symbols);
          
          // No need to manually subscribe - backend auto-subscribes based on session
        }
      });

      // Handle price updates (backend sends 'price' type)
      websocketService.onMessage('price', (message) => {
        const priceData = message.data;
        if (priceData && priceData.symbol) {
          // Update the price in the market store
          useMarketStore.getState().updatePrice(priceData);
        }
      });

      // Handle tick data (more frequent updates)
      websocketService.onMessage('tick', (message) => {
        const tickData = message.data;
        if (tickData && tickData.symbol) {
          useMarketStore.getState().updatePrice(tickData);
        }
      });

      // Handle single symbol auto-subscribe
      websocketService.onMessage('auto_subscribe', (message) => {
        if (message.data && message.data.symbol) {
          useMarketStore.getState().addToWatchlist(message.data.symbol);
        }
      });

      // Handle single symbol auto-unsubscribe
      websocketService.onMessage('auto_unsubscribe', (message) => {
        if (message.data && message.data.symbol) {
          useMarketStore.getState().removeFromWatchlist(message.data.symbol);
        }
      });

      // Set initial connection status
      setConnected(websocketService.isConnected());

      // Register connection status handlers
      const unsubscribeConnect = websocketService.onConnect(() => {
        setConnected(true);
      });

      const unsubscribeDisconnect = websocketService.onDisconnect(() => {
        setConnected(false);
      });

      // Cleanup connection handlers
      return () => {
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
            <TradingViewChart />
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