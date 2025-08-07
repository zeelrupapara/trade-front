import { useState, useEffect, useMemo } from 'react';
import { symbolsService } from '../../services/symbols';
import type { Symbol } from '../../services/symbols';
import { marketWatchService } from '../../services/marketWatch';
import { useMarketStore } from '../../stores/marketStore';

interface SymbolManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SymbolManagementModal({ isOpen, onClose }: SymbolManagementModalProps) {
  const [allSymbols, setAllSymbols] = useState<Symbol[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
  
  const { watchlist } = useMarketStore();

  useEffect(() => {
    if (isOpen) {
      fetchSymbols();
    }
  }, [isOpen]);

  const fetchSymbols = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await symbolsService.getAllSymbols({ active: true });
      console.log('Fetched symbols response:', response);
      setAllSymbols(response.symbols || []);
    } catch (err) {
      console.error('Error loading symbols:', err);
      setError('Failed to load symbols');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSymbols = useMemo(() => {
    if (!searchQuery) return allSymbols;
    
    const query = searchQuery.toLowerCase();
    return allSymbols.filter(symbol => 
      symbol.symbol.toLowerCase().includes(query) ||
      symbol.full_name.toLowerCase().includes(query) ||
      symbol.base_currency.toLowerCase().includes(query)
    );
  }, [allSymbols, searchQuery]);

  const handleAddSymbol = async (symbol: string) => {
    setAddingSymbol(symbol);
    try {
      console.log('Adding symbol to watchlist:', symbol);
      await marketWatchService.addSymbol(symbol);
      console.log('Symbol added successfully:', symbol);
      // The WebSocket auto_subscribe event will update the store
    } catch (err) {
      console.error('Error adding symbol:', err);
      setError(`Failed to add ${symbol}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setAddingSymbol(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Add Symbols to Market Watch</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbols (e.g., BTC, ETH, USDT)"
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {watchlist.length} symbols in your watchlist
          </p>
        </div>

        {/* Symbol List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">{error}</div>
          ) : filteredSymbols.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {searchQuery ? 'No symbols found matching your search' : 'No symbols available'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredSymbols.map((symbol) => {
                const isInWatchlist = watchlist.includes(symbol.symbol);
                return (
                  <div
                    key={symbol.id}
                    className={`p-3 border rounded-lg transition-all ${
                      isInWatchlist
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{symbol.symbol}</div>
                        <div className="text-sm text-gray-500">{symbol.full_name}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {symbol.exchange} • {symbol.instrument_type}
                        </div>
                      </div>
                      <button
                        onClick={() => !isInWatchlist && handleAddSymbol(symbol.symbol)}
                        disabled={isInWatchlist || addingSymbol === symbol.symbol}
                        className={`ml-3 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isInWatchlist
                            ? 'bg-green-100 text-green-700 cursor-not-allowed'
                            : addingSymbol === symbol.symbol
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
                        }`}
                      >
                        {isInWatchlist ? (
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Added
                          </span>
                        ) : addingSymbol === symbol.symbol ? (
                          <span className="flex items-center">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-2"></div>
                            Adding...
                          </span>
                        ) : (
                          'Add'
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {filteredSymbols.length} symbols available
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}