import React, { useCallback, useMemo, useState } from 'react';
import { useMarketStore } from '../../stores/marketStore';
import { marketWatchService } from '../../services/marketWatch';
import SymbolManagementModal from './SymbolManagementModal';
import { MarketWatchRow } from './MarketWatchRow';

export default function MarketWatch() {
  const { 
    watchlist, 
    selectSymbol,
    selectedSymbol,
    symbols
  } = useMarketStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null);
  
  // Calculate overall sync status
  const syncStats = useMemo(() => {
    let syncing = 0;
    let completed = 0;
    let failed = 0;
    let pending = 0;
    let totalProgress = 0;
    
    watchlist.forEach(symbol => {
      const data = symbols.get(symbol);
      const status = data?.sync_status || 'pending';
      const progress = data?.sync_progress || 0;
      
      switch(status) {
        case 'syncing':
          syncing++;
          totalProgress += progress;
          break;
        case 'completed':
          completed++;
          totalProgress += 100;
          break;
        case 'failed':
          failed++;
          break;
        default:
          pending++;
      }
    });
    
    const avgProgress = watchlist.length > 0 ? Math.round(totalProgress / watchlist.length) : 0;
    
    return { syncing, completed, failed, pending, avgProgress };
  }, [watchlist, symbols]);

  // Memoized handlers
  const handleSymbolClick = useCallback((symbol: string) => {
    selectSymbol(symbol);
  }, [selectSymbol]);

  const handleRemoveSymbol = useCallback(async (symbol: string, _e: React.MouseEvent) => {
    setRemovingSymbol(symbol);
    try {
      await marketWatchService.removeSymbol(symbol);
      // The WebSocket will auto-unsubscribe and update the store
    } catch (err) {
      console.error('Error removing symbol:', err);
    } finally {
      setRemovingSymbol(null);
    }
  }, []);
  
  // Memoize the symbol data for each row
  const symbolRows = useMemo(() => {
    return watchlist.map(symbol => {
      const data = symbols.get(symbol);
      return {
        symbol,
        bid: data?.bid || 0,
        ask: data?.ask || 0,
        last: data?.last || 0,
        volume: data?.volume || 0,
      };
    });
  }, [watchlist, symbols]);

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      <div className="p-3 bg-white border-b border-gray-200">
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
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {watchlist.length} symbols
          </div>
          
          {/* Sync Status Summary */}
          {watchlist.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              {syncStats.syncing > 0 && (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-blue-600">{syncStats.syncing} syncing</span>
                </div>
              )}
              
              {syncStats.completed > 0 && (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-green-600">{syncStats.completed} ready</span>
                </div>
              )}
              
              {syncStats.pending > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                  <span className="text-gray-500">{syncStats.pending} pending</span>
                </div>
              )}
              
              {syncStats.failed > 0 && (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-red-600">{syncStats.failed} failed</span>
                </div>
              )}
              
              {/* Overall Progress Bar */}
              {syncStats.avgProgress > 0 && syncStats.avgProgress < 100 && (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${syncStats.avgProgress}%` }}
                    />
                  </div>
                  <span className="text-gray-500">{syncStats.avgProgress}%</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
            <tr className="text-gray-600 text-[11px] font-medium">
              <th className="w-6 py-2"></th>
              <th className="text-left py-2 px-2 font-semibold">Symbol</th>
              <th className="text-right py-2 px-2">Bid</th>
              <th className="text-right py-2 px-2">Ask</th>
              <th className="text-center py-2 px-2">Enigma</th>
              <th className="text-right py-2 px-2">Last</th>
              <th className="text-right py-2 px-2">Change</th>
              <th className="w-6 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {symbolRows.map(row => (
              <MarketWatchRow
                key={row.symbol}
                symbol={row.symbol}
                bid={row.bid}
                ask={row.ask}
                last={row.last}
                volume={row.volume}
                isSelected={selectedSymbol === row.symbol}
                onSelect={handleSymbolClick}
                onRemove={handleRemoveSymbol}
                isRemoving={removingSymbol === row.symbol}
              />
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