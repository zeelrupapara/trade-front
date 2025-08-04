import React, { useEffect, useRef, useState } from 'react';
import { useMarketStore } from '../../stores/marketStore';
import { websocketService } from '../../services/websocket';
import { marketWatchService } from '../../services/marketWatch';
import SymbolManagementModal from './SymbolManagementModal';

interface PriceUpdate {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: number;
}

export default function MarketWatch() {
  const { 
    watchlist, 
    isConnected,
    selectSymbol,
    selectedSymbol,
    symbols
  } = useMarketStore();
  
  const priceRefs = useRef<Map<string, HTMLElement>>(new Map());
  const lastPrices = useRef<Map<string, number>>(new Map());
  const priceColors = useRef<Map<string, string>>(new Map());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null);

  // Update prices with animation
  useEffect(() => {
    symbols.forEach((symbolData, symbol) => {
      // Update bid
      const bidElement = document.querySelector(`[data-symbol-bid="${symbol}"]`);
      if (bidElement) {
        const oldBid = lastPrices.current.get(`${symbol}-bid`) || 0;
        bidElement.textContent = symbolData.bid.toFixed(5);
        if (oldBid !== 0 && oldBid !== symbolData.bid) {
          const newColor = symbolData.bid > oldBid ? '#10b981' : '#ef4444';
          bidElement.style.color = newColor;
          priceColors.current.set(`${symbol}-bid`, newColor);
        } else if (priceColors.current.has(`${symbol}-bid`)) {
          bidElement.style.color = priceColors.current.get(`${symbol}-bid`)!;
        }
        lastPrices.current.set(`${symbol}-bid`, symbolData.bid);
      }
      
      // Update ask
      const askElement = document.querySelector(`[data-symbol-ask="${symbol}"]`);
      if (askElement) {
        const oldAsk = lastPrices.current.get(`${symbol}-ask`) || 0;
        askElement.textContent = symbolData.ask.toFixed(5);
        if (oldAsk !== 0 && oldAsk !== symbolData.ask) {
          const newColor = symbolData.ask > oldAsk ? '#10b981' : '#ef4444';
          askElement.style.color = newColor;
          priceColors.current.set(`${symbol}-ask`, newColor);
        } else if (priceColors.current.has(`${symbol}-ask`)) {
          askElement.style.color = priceColors.current.get(`${symbol}-ask`)!;
        }
        lastPrices.current.set(`${symbol}-ask`, symbolData.ask);
      }
      
      // Update last
      const lastElement = document.querySelector(`[data-symbol-last="${symbol}"]`);
      if (lastElement) {
        const oldLast = lastPrices.current.get(`${symbol}-last`) || 0;
        lastElement.textContent = symbolData.last.toFixed(5);
        if (oldLast !== 0 && oldLast !== symbolData.last) {
          const newColor = symbolData.last > oldLast ? '#10b981' : '#ef4444';
          lastElement.style.color = newColor;
          priceColors.current.set(`${symbol}-last`, newColor);
        } else if (priceColors.current.has(`${symbol}-last`)) {
          lastElement.style.color = priceColors.current.get(`${symbol}-last`)!;
        }
        lastPrices.current.set(`${symbol}-last`, symbolData.last);
      }
      
      // Update volume
      const volumeElement = document.querySelector(`[data-symbol-volume="${symbol}"]`);
      if (volumeElement && symbolData.volume !== undefined) {
        volumeElement.textContent = symbolData.volume.toFixed(2);
      }
    });
  }, [symbols]);

  const handleSymbolClick = (symbol: string) => {
    selectSymbol(symbol);
  };

  const handleRemoveSymbol = async (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    setRemovingSymbol(symbol);
    try {
      await marketWatchService.removeSymbol(symbol);
      // The WebSocket will auto-unsubscribe and update the store
    } catch (err) {
      // Error removing symbol
    } finally {
      setRemovingSymbol(null);
    }
  };

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Market Watch</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
              title="Manage Symbols"
            >
              <svg 
                className="w-5 h-5 text-gray-600 group-hover:text-gray-800" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
                />
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
                />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          {watchlist.length} symbols
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="text-gray-600 border-b border-gray-200">
              <th className="text-left p-3">Symbol</th>
              <th className="text-right p-3">Bid</th>
              <th className="text-right p-3">Ask</th>
              <th className="text-right p-3">Last</th>
              <th className="text-right p-3">Volume</th>
              <th className="text-center p-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map(symbol => (
              <tr 
                key={symbol}
                className={`border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedSymbol === symbol ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleSymbolClick(symbol)}
                data-symbol={symbol}
              >
                <td className="p-3 text-gray-900 font-medium">{symbol}</td>
                <td className="p-3 text-right">
                  <span 
                    data-symbol-bid={symbol}
                    className="font-mono text-gray-700"
                  >
                    {symbols.get(symbol)?.bid?.toFixed(5) || '0.00000'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <span 
                    data-symbol-ask={symbol}
                    className="font-mono text-gray-700"
                  >
                    {symbols.get(symbol)?.ask?.toFixed(5) || '0.00000'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <span 
                    data-symbol-last={symbol}
                    className="font-mono text-gray-700"
                  >
                    {symbols.get(symbol)?.last?.toFixed(5) || '0.00000'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <span 
                    data-symbol-volume={symbol}
                    className="font-mono text-gray-700"
                  >
                    {symbols.get(symbol)?.volume?.toFixed(2) || '0.00'}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={(e) => handleRemoveSymbol(symbol, e)}
                    disabled={removingSymbol === symbol}
                    className="p-1 hover:bg-red-50 rounded transition-colors group"
                    title="Remove from watchlist"
                  >
                    {removingSymbol === symbol ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                    ) : (
                      <svg 
                        className="w-4 h-4 text-gray-400 group-hover:text-red-500" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M6 18L18 6M6 6l12 12" 
                        />
                      </svg>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {watchlist.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600 font-medium">No symbols in watchlist</p>
              <p className="text-sm text-gray-500 mt-1">Click the settings icon to add symbols</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Add Symbols
            </button>
          </div>
        )}
      </div>

      {/* Symbol Management Modal */}
      <SymbolManagementModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}