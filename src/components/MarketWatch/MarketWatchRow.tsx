import React, { memo, useCallback, useRef, useEffect, useState } from 'react';
import { useMarketStore } from '../../stores/marketStore';
import './MarketWatch.css';

interface MarketWatchRowProps {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  isSelected: boolean;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string, e: React.MouseEvent) => void;
  isRemoving: boolean;
}

// Sync Status Icon Component - Compact for better multi-symbol viewing
const SyncStatusIcon = memo(({ status, progress }: { 
  status?: 'pending' | 'syncing' | 'completed' | 'failed'; 
  progress?: number 
}) => {
  switch (status) {
    case 'pending':
      return (
        <div className="flex items-center justify-center" title="Pending">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
        </div>
      );
    case 'syncing':
      return (
        <div className="flex flex-col items-center justify-center" title={`${progress || 0}%`}>
          <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-[10px] text-blue-600 font-bold mt-0.5">
            {progress}%
          </span>
        </div>
      );
    case 'completed':
      return (
        <div className="flex items-center justify-center" title="Ready">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
      );
    case 'failed':
      return (
        <div className="flex items-center justify-center" title="Failed">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center">
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        </div>
      );
  }
});

SyncStatusIcon.displayName = 'SyncStatusIcon';

// Enigma Level Component - Shows current position between All-Time Low and All-Time High
const EnigmaIndicator = memo(({ level, assetClass }: { level?: number; assetClass?: string }) => {
  // Show -- if no data, don't show 0.0% for undefined/null
  if (level === undefined || level === null) {
    return <span className="text-gray-400 text-xs">--</span>;
  }

  const getColor = () => {
    if (level < 20) return 'text-red-500';
    if (level < 40) return 'text-orange-500';
    if (level < 60) return 'text-yellow-500';
    if (level < 80) return 'text-blue-500';
    return 'text-green-500';
  };

  const getAssetIcon = () => {
    switch(assetClass) {
      case 'crypto': return '₿';
      case 'forex': return '💱';
      case 'stock': return '📈';
      case 'commodity': return '🛢️';
      case 'index': return '📊';
      default: return '';
    }
  };

  return (
    <div className="flex items-center justify-center gap-1">
      {assetClass && <span className="text-xs">{getAssetIcon()}</span>}
      <span className={`${getColor()} font-semibold text-xs`} title={`All-Time: ${level.toFixed(1)}%`}>
        {level.toFixed(1)}%
      </span>
    </div>
  );
});

EnigmaIndicator.displayName = 'EnigmaIndicator';

// Memoized price cell component with live color updates
const PriceCell = memo(({ 
  value, 
  type, 
  symbol,
  change
}: { 
  value: number; 
  type: 'bid' | 'ask' | 'last'; 
  symbol: string;
  change?: number;
}) => {
  const cellRef = useRef<HTMLSpanElement>(null);
  const previousValue = useRef(value);
  const [isFlashing, setIsFlashing] = useState(false);
  const animationTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  
  useEffect(() => {
    if (previousValue.current !== value && previousValue.current !== 0) {
      // Clear any existing animation
      if (animationTimeout.current) {
        clearTimeout(animationTimeout.current);
      }
      
      // Trigger flash animation
      setIsFlashing(true);
      
      // Reset flash after animation
      animationTimeout.current = setTimeout(() => {
        setIsFlashing(false);
      }, 500);
    }
    
    previousValue.current = value;
    
    return () => {
      if (animationTimeout.current) {
        clearTimeout(animationTimeout.current);
      }
    };
  }, [value]);

  const formatPrice = (price: number) => {
    if (!price) return '0.00';
    if (price > 1000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toFixed(price < 1 ? 4 : 2);
  };
  
  const getBaseColor = () => {
    // Keep the last known color direction even when change is 0
    // Use previous value comparison as fallback
    if (change !== undefined && change !== 0) {
      return change > 0 ? 'text-green-600' : 'text-red-600';
    }
    // If no change but we have different values, determine color from comparison
    if (previousValue.current && previousValue.current !== value) {
      return value > previousValue.current ? 'text-green-600' : 'text-red-600';
    }
    // Default to neutral for initial state
    return 'text-gray-700';
  };
  
  const getFlashColor = () => {
    if (!previousValue.current || previousValue.current === value) return '';
    return value > previousValue.current ? 'text-green-500 font-bold' : 'text-red-500 font-bold';
  };
  
  return (
    <span 
      ref={cellRef}
      className={`font-mono text-sm transition-all duration-300 ${
        isFlashing ? getFlashColor() : getBaseColor()
      } ${type === 'last' ? 'font-semibold' : ''}`}
      data-symbol-price={`${symbol}-${type}`}
    >
      {formatPrice(value)}
    </span>
  );
});

PriceCell.displayName = 'PriceCell';

// Memoized volume cell
const VolumeCell = memo(({ value }: { value: number }) => {
  const formatVolume = (vol: number) => {
    if (!vol) return '0';
    if (vol > 1000000) {
      return (vol / 1000000).toFixed(2) + 'M';
    }
    if (vol > 1000) {
      return (vol / 1000).toFixed(2) + 'K';
    }
    return vol.toFixed(2);
  };

  return (
    <span className="font-mono text-gray-700">
      {formatVolume(value)}
    </span>
  );
});

VolumeCell.displayName = 'VolumeCell';

// Animated Arrow Component - Professional Trading Style
const PriceArrow = memo(({ change }: { change: number }) => {
  if (change === 0) {
    return (
      <div className="w-4 h-5 flex items-center justify-center">
        <div className="w-2 h-0.5 bg-gray-400"></div>
      </div>
    );
  }
  
  return (
    <div className="w-4 h-5 flex items-center justify-center">
      {change > 0 ? (
        <svg className="w-4 h-4 text-green-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 5l-6 7h12l-6-7z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-red-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 15l6-7H4l6 7z" />
        </svg>
      )}
    </div>
  );
});

PriceArrow.displayName = 'PriceArrow';

// Main row component with memoization
export const MarketWatchRow = memo(({
  symbol,
  bid,
  ask,
  last,
  volume: _volume,
  isSelected,
  onSelect,
  onRemove,
  isRemoving
}: MarketWatchRowProps) => {
  // Get additional symbol data from store
  const symbolData = useMarketStore((state) => state.symbols.get(symbol));
  const isConnected = useMarketStore((state) => state.isConnected);
  
  const handleClick = useCallback(() => {
    onSelect(symbol);
  }, [symbol, onSelect]);
  
  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(symbol, e);
  }, [symbol, onRemove]);
  
  const changePercent = symbolData?.changePercent || 0;
  const isOffline = !isConnected || symbolData?.sync_status === 'failed';
  
  // Color scheme based on price movement and connection status
  const getPriceColor = () => {
    if (isOffline) return 'text-gray-400';
    if (changePercent > 0) return 'text-green-600';
    if (changePercent < 0) return 'text-red-600';
    return 'text-gray-700';
  };
  
  getPriceColor(); // For future use
  
  return (
    <tr 
      className={`group cursor-pointer transition-all duration-150 border-b border-gray-100 ${
        isSelected ? 'bg-blue-50' : 
        'bg-white hover:bg-gray-50'
      }`}
      onClick={handleClick}
      data-symbol={symbol}
    >
      {/* Arrow Column - First */}
      <td className="py-2 pl-3 pr-1">
        <PriceArrow change={changePercent} />
      </td>
      
      {/* Symbol Column */}
      <td className="py-2 px-2 font-medium">
        <div className="flex flex-col">
          <span className={`${
            isSelected ? 'text-blue-700 font-bold' : 'text-gray-800 font-semibold'
          } text-sm`}>
            {symbol}
          </span>
          {symbolData?.sync_status === 'syncing' && (
            <span className="text-[10px] text-blue-500 font-medium">
              Sync: {symbolData?.sync_progress || 0}%
            </span>
          )}
        </div>
      </td>
      
      {/* Bid Column */}
      <td className="py-2 px-2 text-right">
        <PriceCell 
          value={bid} 
          type="bid" 
          symbol={symbol}
          change={changePercent}
        />
      </td>
      
      {/* Ask Column */}
      <td className="py-2 px-2 text-right">
        <PriceCell 
          value={ask} 
          type="ask" 
          symbol={symbol}
          change={changePercent}
        />
      </td>
      
      {/* Enigma Column */}
      <td className="py-2 px-2 text-center">
        <EnigmaIndicator 
          level={symbolData?.enigma?.level} 
          assetClass={symbolData?.enigma?.asset_class}
        />
      </td>
      
      {/* Last Price Column */}
      <td className="py-2 px-2 text-right">
        <PriceCell 
          value={last} 
          type="last" 
          symbol={symbol}
          change={changePercent}
        />
      </td>
      
      {/* Change Column */}
      <td className="py-2 px-2 text-right">
        <div className="flex flex-col items-end">
          <div className={`inline-flex items-center justify-end px-1.5 py-0.5 rounded text-xs font-semibold transition-all duration-300 ${
            changePercent > 0 ? 'bg-green-100 text-green-700' : 
            changePercent < 0 ? 'bg-red-100 text-red-700' : 
            'bg-gray-100 text-gray-600'
          }`}>
            {changePercent > 0 ? '+' : ''}{changePercent.toFixed(2)}%
          </div>
          {symbolData?.change !== undefined && (
            <span className={`text-[10px] mt-0.5 ${
              symbolData.change > 0 ? 'text-green-600' : 
              symbolData.change < 0 ? 'text-red-600' : 
              'text-gray-500'
            }`}>
              {symbolData.change > 0 ? '+' : ''}{symbolData.change.toFixed(2)}
            </span>
          )}
        </div>
      </td>
      
      {/* Actions Column */}
      <td className="py-2 px-1 text-center">
        <button
          onClick={handleRemove}
          disabled={isRemoving}
          className="p-0.5 rounded transition-colors group/remove hover:bg-red-50"
          title="Remove"
        >
          {isRemoving ? (
            <svg className="w-3 h-3 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg 
              className="w-3 h-3 text-gray-400 group-hover/remove:text-red-500 transition-colors"
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
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for optimization
  return (
    prevProps.symbol === nextProps.symbol &&
    prevProps.bid === nextProps.bid &&
    prevProps.ask === nextProps.ask &&
    prevProps.last === nextProps.last &&
    prevProps.volume === nextProps.volume &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isRemoving === nextProps.isRemoving
  );
});

MarketWatchRow.displayName = 'MarketWatchRow';