import React, { useEffect, useState } from 'react';
import { enigmaService } from '../../services/enigma';
import type { EnigmaData, AssetExtreme } from '../../services/enigma';
import { Card } from '../ui/Card';

interface EnigmaPanelProps {
  symbol: string;
  className?: string;
}

export const EnigmaPanel: React.FC<EnigmaPanelProps> = ({ symbol, className = '' }) => {
  const [enigmaData, setEnigmaData] = useState<EnigmaData | null>(null);
  const [extremeData, setExtremeData] = useState<AssetExtreme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;

    const fetchEnigmaData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch both Enigma levels and extreme data
        const [enigma, extremes] = await Promise.all([
          enigmaService.getEnigmaLevels(symbol),
          enigmaService.getExtremes(symbol)
        ]);
        
        setEnigmaData(enigma);
        setExtremeData(extremes);
      } catch (err) {
        console.error('Failed to fetch Enigma data:', err);
        setError('Failed to load Enigma data');
      } finally {
        setLoading(false);
      }
    };

    fetchEnigmaData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchEnigmaData, 30000);
    
    return () => clearInterval(interval);
  }, [symbol]);

  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-8 bg-gray-700 rounded w-1/2"></div>
        </div>
      </Card>
    );
  }

  if (error || !enigmaData) {
    return (
      <Card className={`p-4 ${className}`}>
        <p className="text-red-500 text-sm">{error || 'No data available'}</p>
      </Card>
    );
  }

  const levelColor = enigmaService.getLevelColor(enigmaData.current_level);
  const sentiment = enigmaService.getMarketSentiment(enigmaData.current_level);
  const assetIcon = enigmaService.getAssetClassIcon(enigmaData.asset_class);
  const assetName = enigmaService.getAssetClassName(enigmaData.asset_class);

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="border-b border-gray-700 pb-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-semibold text-gray-200">
              Enigma Fibonacci Analysis
            </h3>
            <span className="text-2xl">{assetIcon}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>{symbol}</span>
            <span>•</span>
            <span>{assetName}</span>
            {extremeData?.data_source && (
              <>
                <span>•</span>
                <span className="text-xs">Source: {extremeData.data_source}</span>
              </>
            )}
          </div>
        </div>

        {/* Current Level */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Current Level</span>
            <span className="text-sm font-medium" style={{ color: levelColor }}>
              {sentiment}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-700 rounded-full h-2 relative">
              <div
                className="absolute top-0 left-0 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, enigmaData.current_level))}%`,
                  backgroundColor: levelColor,
                }}
              />
            </div>
            <span className="text-xl font-bold" style={{ color: levelColor }}>
              {enigmaData.current_level.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* All-Time Extremes */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">All-Time High</div>
            <div className="text-lg font-semibold text-green-500">
              {enigmaService.formatPrice(enigmaData.ath)}
            </div>
            {extremeData?.ath_date && (
              <div className="text-xs text-gray-500 mt-1">
                {new Date(extremeData.ath_date).toLocaleDateString()}
              </div>
            )}
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">All-Time Low</div>
            <div className="text-lg font-semibold text-red-500">
              {enigmaService.formatPrice(enigmaData.atl)}
            </div>
            {extremeData?.atl_date && (
              <div className="text-xs text-gray-500 mt-1">
                {new Date(extremeData.atl_date).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {/* Fibonacci Levels */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300">Fibonacci Retracement Levels</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(enigmaData.levels).map(([level, price]) => {
              const isATL = level === '0';
              const isATH = level === '100';
              const levelNum = parseFloat(level);
              const isNearLevel = Math.abs(enigmaData.current_level - levelNum) < 5;
              
              return (
                <div
                  key={level}
                  className={`flex justify-between p-2 rounded ${
                    isNearLevel ? 'bg-gray-700' : 'bg-gray-800'
                  } ${isATL || isATH ? 'font-semibold' : ''}`}
                >
                  <span className={`${isATL ? 'text-red-400' : isATH ? 'text-green-400' : 'text-gray-400'}`}>
                    {isATL ? 'ATL (0%)' : isATH ? 'ATH (100%)' : `${level}%`}
                  </span>
                  <span className={`${isATL ? 'text-red-500' : isATH ? 'text-green-500' : 'text-gray-300'}`}>
                    {enigmaService.formatPrice(price)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Last Updated */}
        <div className="text-xs text-gray-500 text-right">
          Last updated: {new Date(enigmaData.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </Card>
  );
};