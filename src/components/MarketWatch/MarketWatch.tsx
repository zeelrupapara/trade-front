import React, { useEffect, useRef } from 'react';
import { useMarketStore } from '../../stores/marketStore';
import { websocketService } from '../../services/websocket';

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

  // Update prices with animation
  useEffect(() => {
    symbols.forEach((symbolData, symbol) => {
      // Update bid
      const bidElement = document.querySelector(`[data-symbol-bid="${symbol}"]`);
      if (bidElement) {
        const oldBid = lastPrices.current.get(`${symbol}-bid`) || 0;
        bidElement.textContent = symbolData.bid.toFixed(5);
        if (oldBid !== 0 && oldBid !== symbolData.bid) {
          bidElement.style.color = symbolData.bid > oldBid ? '#10b981' : '#ef4444';
          setTimeout(() => {
            bidElement.style.color = '#374151';
          }, 500);
        }
        lastPrices.current.set(`${symbol}-bid`, symbolData.bid);
      }
      
      // Update ask
      const askElement = document.querySelector(`[data-symbol-ask="${symbol}"]`);
      if (askElement) {
        const oldAsk = lastPrices.current.get(`${symbol}-ask`) || 0;
        askElement.textContent = symbolData.ask.toFixed(5);
        if (oldAsk !== 0 && oldAsk !== symbolData.ask) {
          askElement.style.color = symbolData.ask > oldAsk ? '#10b981' : '#ef4444';
          setTimeout(() => {
            askElement.style.color = '#374151';
          }, 500);
        }
        lastPrices.current.set(`${symbol}-ask`, symbolData.ask);
      }
      
      // Update last
      const lastElement = document.querySelector(`[data-symbol-last="${symbol}"]`);
      if (lastElement) {
        const oldLast = lastPrices.current.get(`${symbol}-last`) || 0;
        lastElement.textContent = symbolData.last.toFixed(5);
        if (oldLast !== 0 && oldLast !== symbolData.last) {
          lastElement.style.color = symbolData.last > oldLast ? '#10b981' : '#ef4444';
          setTimeout(() => {
            lastElement.style.color = '#374151';
          }, 500);
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

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Market Watch</h2>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
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
              </tr>
            ))}
          </tbody>
        </table>
        
        {watchlist.length === 0 && (
          <div className="p-4 text-center text-gray-600">
            No symbols in watchlist
          </div>
        )}
      </div>
    </div>
  );
}