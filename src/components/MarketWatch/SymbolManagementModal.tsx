import { useState, useEffect, useMemo } from 'react';
import { symbolsService } from '../../services/symbols';
import type { Symbol } from '../../services/symbols';
import { marketWatchService } from '../../services/marketWatch';
import { useMarketStore } from '../../stores/marketStore';

interface SymbolManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SidebarSection = 'symbols' | 'indicators';

// Get indicator settings from localStorage
const getIndicatorSettings = () => {
  const stored = localStorage.getItem('indicatorSettings');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback to defaults
    }
  }
  return {
    enigmaEnabled: true,
    periodLevelsEnabled: true,
  };
};

// Save indicator settings to localStorage
const saveIndicatorSettings = (settings: { enigmaEnabled: boolean; periodLevelsEnabled: boolean }) => {
  localStorage.setItem('indicatorSettings', JSON.stringify(settings));
  // Dispatch custom event for chart to listen to
  window.dispatchEvent(new CustomEvent('indicatorSettingsChanged', { detail: settings }));
};

export default function SymbolManagementModal({ isOpen, onClose }: SymbolManagementModalProps) {
  const [allSymbols, setAllSymbols] = useState<Symbol[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SidebarSection>('symbols');
  
  // Indicator settings
  const [enigmaEnabled, setEnigmaEnabled] = useState(true);
  const [periodLevelsEnabled, setPeriodLevelsEnabled] = useState(true);
  
  const { watchlist } = useMarketStore();

  useEffect(() => {
    if (isOpen) {
      fetchSymbols();
      // Load saved indicator settings
      const settings = getIndicatorSettings();
      setEnigmaEnabled(settings.enigmaEnabled);
      setPeriodLevelsEnabled(settings.periodLevelsEnabled);
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

  const handleEnigmaToggle = (enabled: boolean) => {
    setEnigmaEnabled(enabled);
    saveIndicatorSettings({ enigmaEnabled: enabled, periodLevelsEnabled });
  };

  const handlePeriodLevelsToggle = (enabled: boolean) => {
    setPeriodLevelsEnabled(enabled);
    saveIndicatorSettings({ enigmaEnabled, periodLevelsEnabled: enabled });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex">
        {/* Sidebar */}
        <div className="w-64 bg-gray-50 border-r border-gray-200 rounded-l-lg">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
          </div>
          <div className="p-2">
            <button
              onClick={() => setActiveSection('symbols')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeSection === 'symbols' 
                  ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span className="font-medium">Symbols</span>
            </button>
            
            <button
              onClick={() => setActiveSection('indicators')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mt-1 ${
                activeSection === 'indicators' 
                  ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="font-medium">Indicators</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              {activeSection === 'symbols' ? 'Manage Symbols' : 'Indicator Settings'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content based on active section */}
          {activeSection === 'symbols' ? (
            <>
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
            </>
          ) : (
            /* Indicators Section */
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Chart Indicators</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Configure which indicators are displayed on your trading charts
                  </p>
                  
                  {/* Enigma Indicator Toggle */}
                  <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Enigma Indicator</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          All-time high/low levels with Fibonacci retracement zones
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">All-Time</span>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Fibonacci</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enigmaEnabled}
                          onChange={(e) => handleEnigmaToggle(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>

                  {/* Period Levels Toggle */}
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Period Levels</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          Daily, weekly, and monthly ATH/ATL horizontal lines
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">Daily</span>
                          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">Weekly</span>
                          <span className="text-xs px-2 py-1 bg-cyan-100 text-cyan-700 rounded">Monthly</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={periodLevelsEnabled}
                          onChange={(e) => handlePeriodLevelsToggle(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Info Section */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h4 className="font-medium text-blue-900">How it works</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        These settings control which indicators are displayed on your trading charts. 
                        Changes are applied immediately to all open charts and will be saved for future sessions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-br-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {activeSection === 'symbols' 
                  ? `${filteredSymbols.length} symbols available`
                  : 'Settings auto-save'}
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
    </div>
  );
}