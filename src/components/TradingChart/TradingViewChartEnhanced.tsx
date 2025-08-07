import { useEffect, useRef, useState, useCallback } from 'react';
import { useMarketStore } from '../../stores/marketStore';
import { websocketService } from '../../services/websocket';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface EnigmaLevel {
  price: number;
  label: string;
  color: string;
  percentage: number;
}

export default function TradingViewChartEnhanced() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const chartRef = useRef<any>(null);
  const enigmaShapesRef = useRef<string[]>([]);
  const [showEnigmaLevels, setShowEnigmaLevels] = useState(true);
  const [currentEnigmaData, setCurrentEnigmaData] = useState<any>(null);
  
  const { selectedSymbol, symbols } = useMarketStore();
  const symbolData = selectedSymbol ? symbols.get(selectedSymbol) : null;

  // Function to draw Enigma levels on the chart
  const drawEnigmaLevels = useCallback((enigmaData: any) => {
    if (!chartRef.current || !enigmaData) return;

    // Clear existing Enigma shapes
    enigmaShapesRef.current.forEach(shapeId => {
      try {
        chartRef.current.removeEntity(shapeId);
      } catch (e) {
        // Shape might already be removed
      }
    });
    enigmaShapesRef.current = [];

    if (!showEnigmaLevels) return;

    const fibLevels = enigmaData.fib_levels || enigmaData.fibLevels;
    if (!fibLevels) return;

    // Define Enigma levels with premium colors
    const levels: EnigmaLevel[] = [
      { price: fibLevels['0'] || enigmaData.atl, label: 'ATL (0%)', color: '#ef4444', percentage: 0 },
      { price: fibLevels['23.6'] || fibLevels['236'], label: '23.6%', color: '#f59e0b', percentage: 23.6 },
      { price: fibLevels['38.2'] || fibLevels['382'], label: '38.2%', color: '#eab308', percentage: 38.2 },
      { price: fibLevels['50'], label: '50%', color: '#3b82f6', percentage: 50 },
      { price: fibLevels['61.8'] || fibLevels['618'], label: '61.8%', color: '#06b6d4', percentage: 61.8 },
      { price: fibLevels['78.6'] || fibLevels['786'], label: '78.6%', color: '#8b5cf6', percentage: 78.6 },
      { price: fibLevels['100'] || enigmaData.ath, label: 'ATH (100%)', color: '#10b981', percentage: 100 }
    ];

    // Draw each level
    levels.forEach((level) => {
      if (!level.price || level.price <= 0) return;

      try {
        // Create horizontal line for each Fibonacci level
        const shapeId = chartRef.current.createShape(
          { price: level.price },
          {
            shape: 'horizontal_line',
            lock: true,
            disableSelection: true,
            disableSave: true,
            disableUndo: true,
            overrides: {
              linecolor: level.color,
              linewidth: level.percentage === 0 || level.percentage === 100 || level.percentage === 50 ? 2 : 1,
              linestyle: level.percentage === 50 ? 0 : 2, // Solid for 50%, dashed for others
              transparency: 30,
              showLabel: true,
              text: `${level.label}: $${formatPrice(level.price)}`,
              textcolor: level.color,
              fontsize: 11,
              bold: level.percentage === 0 || level.percentage === 100 || level.percentage === 50
            }
          }
        );

        if (shapeId) {
          enigmaShapesRef.current.push(shapeId);
        }
      } catch (error) {
        console.error('Error drawing Enigma level:', error);
      }
    });

    // Draw current Enigma level indicator
    if (enigmaData.level !== undefined && symbolData?.price) {
      try {
        const currentLevelShape = chartRef.current.createShape(
          { price: symbolData.price },
          {
            shape: 'arrow_marker',
            lock: true,
            disableSelection: true,
            disableSave: true,
            overrides: {
              color: getEnigmaLevelColor(enigmaData.level),
              text: `Enigma: ${enigmaData.level.toFixed(1)}%`,
              fontsize: 12,
              bold: true
            }
          }
        );
        
        if (currentLevelShape) {
          enigmaShapesRef.current.push(currentLevelShape);
        }
      } catch (error) {
        console.error('Error drawing current Enigma level:', error);
      }
    }
  }, [showEnigmaLevels, symbolData]);

  // Initialize TradingView widget
  useEffect(() => {
    if (!containerRef.current || !selectedSymbol) return;

    // Check if TradingView library is available
    if (!window.TradingView) {
      console.warn('TradingView library not loaded');
      // Show placeholder
      containerRef.current.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f9fafb; border-radius: 8px;">
          <div style="text-align: center; padding: 2rem;">
            <svg style="width: 64px; height: 64px; margin: 0 auto 1rem; color: #6b7280;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            <h3 style="font-size: 1.125rem; font-weight: 600; color: #111827; margin-bottom: 0.5rem;">
              ${selectedSymbol} Chart
            </h3>
            <p style="color: #6b7280; font-size: 0.875rem;">
              TradingView chart will appear here
            </p>
            ${symbolData?.enigma ? `
              <div style="margin-top: 1rem; padding: 1rem; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                <div style="font-size: 0.75rem; color: #6b7280; margin-bottom: 0.5rem;">Enigma Level</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: ${getEnigmaLevelColor(symbolData.enigma.level)};">
                  ${symbolData.enigma.level.toFixed(1)}%
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
      return;
    }

    // Create TradingView widget
    const widget = new window.TradingView.widget({
      autosize: true,
      symbol: `BINANCE:${selectedSymbol}`,
      interval: '15',
      timezone: 'Etc/UTC',
      theme: 'light',
      style: '1',
      locale: 'en',
      toolbar_bg: '#ffffff',
      enable_publishing: false,
      allow_symbol_change: false,
      container_id: containerRef.current.id || 'tradingview_chart',
      studies: [],
      disabled_features: ['use_localstorage_for_settings'],
      enabled_features: ['study_templates'],
      overrides: {
        'mainSeriesProperties.candleStyle.upColor': '#10b981',
        'mainSeriesProperties.candleStyle.downColor': '#ef4444',
        'mainSeriesProperties.candleStyle.borderUpColor': '#10b981',
        'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
        'mainSeriesProperties.candleStyle.wickUpColor': '#10b981',
        'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
      }
    });

    widgetRef.current = widget;

    // Wait for chart to be ready
    widget.onChartReady(() => {
      chartRef.current = widget.chart();
      
      // Draw Enigma levels if available
      if (symbolData?.enigma) {
        setCurrentEnigmaData(symbolData.enigma);
        drawEnigmaLevels(symbolData.enigma);
      }
    });

    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
        chartRef.current = null;
      }
    };
  }, [selectedSymbol]);

  // Update Enigma levels when data changes
  useEffect(() => {
    if (symbolData?.enigma && JSON.stringify(symbolData.enigma) !== JSON.stringify(currentEnigmaData)) {
      setCurrentEnigmaData(symbolData.enigma);
      drawEnigmaLevels(symbolData.enigma);
    }
  }, [symbolData?.enigma, drawEnigmaLevels, currentEnigmaData]);

  // Subscribe to Enigma updates via WebSocket
  useEffect(() => {
    const handleEnigmaUpdate = (message: any) => {
      if (message.data?.symbol === selectedSymbol) {
        setCurrentEnigmaData(message.data);
        drawEnigmaLevels(message.data);
      }
    };

    const unsubscribe = websocketService.onMessage('enigma_update', handleEnigmaUpdate);
    return unsubscribe;
  }, [selectedSymbol, drawEnigmaLevels]);

  return (
    <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedSymbol || 'Select a symbol'}
          </h2>
          {symbolData && (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-gray-900">
                ${formatPrice(symbolData.price || symbolData.last || 0)}
              </span>
              <span className={`text-sm font-medium ${
                symbolData.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {symbolData.changePercent >= 0 ? '+' : ''}{symbolData.changePercent?.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {symbolData?.enigma && (
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-600">Enigma:</span>
              <span className={`text-sm font-semibold`} style={{ color: getEnigmaLevelColor(symbolData.enigma.level) }}>
                {symbolData.enigma.level.toFixed(1)}%
              </span>
            </div>
          )}
          
          <button
            onClick={() => setShowEnigmaLevels(!showEnigmaLevels)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
              showEnigmaLevels 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
              />
            </svg>
            <span className="text-sm font-medium">Enigma Levels</span>
          </button>
        </div>
      </div>
      
      <div 
        ref={containerRef} 
        id="tradingview_chart"
        className="h-[500px] rounded-lg overflow-hidden"
      />
      
      {showEnigmaLevels && symbolData?.enigma && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-2">Fibonacci Retracement Levels</div>
          <div className="grid grid-cols-7 gap-2">
            {[
              { level: '0%', value: symbolData.enigma.fib_levels?.['0'] || symbolData.enigma.atl, color: '#ef4444' },
              { level: '23.6%', value: symbolData.enigma.fib_levels?.['23.6'], color: '#f59e0b' },
              { level: '38.2%', value: symbolData.enigma.fib_levels?.['38.2'], color: '#eab308' },
              { level: '50%', value: symbolData.enigma.fib_levels?.['50'], color: '#3b82f6' },
              { level: '61.8%', value: symbolData.enigma.fib_levels?.['61.8'], color: '#06b6d4' },
              { level: '78.6%', value: symbolData.enigma.fib_levels?.['78.6'], color: '#8b5cf6' },
              { level: '100%', value: symbolData.enigma.fib_levels?.['100'] || symbolData.enigma.ath, color: '#10b981' }
            ].map((fib) => (
              <div key={fib.level} className="text-center">
                <div className="text-xs font-medium" style={{ color: fib.color }}>{fib.level}</div>
                <div className="text-xs text-gray-700">${formatPrice(fib.value || 0)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatPrice(price: number): string {
  if (!price) return '0.00';
  if (price > 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return price.toFixed(price < 1 ? 6 : 2);
}

function getEnigmaLevelColor(level: number): string {
  if (level < 20) return '#ef4444'; // Red - Oversold
  if (level < 40) return '#f59e0b'; // Orange
  if (level < 60) return '#3b82f6'; // Blue - Neutral
  if (level < 80) return '#8b5cf6'; // Purple
  return '#10b981'; // Green - Overbought
}