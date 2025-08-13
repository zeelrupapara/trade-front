import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../ui/Card';
import { 
  periodLevelsService,
  PERIOD_COLORS
} from '../../services/periodLevels';
import type {
  PeriodLevel, 
  PeriodLevelsResponse,
  LevelApproachAlert
  // PeriodLevelUpdate - will be used when WebSocket integration is completed
} from '../../services/periodLevels';
import './PeriodLevels.css';

interface PeriodLevelsProps {
  symbol: string;
  currentPrice?: number;
  onLevelClick?: (level: number, period: string) => void;
}

export const PeriodLevels: React.FC<PeriodLevelsProps> = ({ 
  symbol, 
  currentPrice,
  onLevelClick: _onLevelClick 
}) => {
  const [levels, setLevels] = useState<PeriodLevelsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set(['daily']));
  const [alerts, setAlerts] = useState<LevelApproachAlert[]>([]);

  // Load period levels
  const loadLevels = useCallback(async () => {
    if (!symbol) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await periodLevelsService.getAllPeriodLevels(symbol);
      setLevels(data);
      
      // Check for near level alerts if we have current price
      if (currentPrice) {
        const alertsData = await periodLevelsService.getNearLevelAlerts(symbol, currentPrice);
        setAlerts(alertsData.alerts || []);
      }
    } catch (err) {
      setError('Failed to load period levels');
      console.error('Error loading period levels:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol, currentPrice]);

  useEffect(() => {
    loadLevels();
  }, [loadLevels]);

  // WebSocket updates handler
  useEffect(() => {
    // These handlers are commented out for now as WebSocket integration
    // needs to be properly connected through a WebSocket context
    // const handlePeriodUpdate = (update: PeriodLevelUpdate) => {
    //   if (update.symbol !== symbol) return;
    //   
    //   // Update specific period level
    //   setLevels(prev => {
    //     if (!prev) return prev;
    //     
    //     const newLevels = { ...prev };
    //     if (update.level) {
    //       newLevels[update.period] = update.level;
    //     }
    //     return newLevels;
    //   });
    // };

    // const handleLevelApproach = (alert: LevelApproachAlert) => {
    //   if (alert.symbol !== symbol) return;
    //   
    //   // Add to alerts (remove after 5 seconds)
    //   setAlerts(prev => [...prev, alert]);
    //   setTimeout(() => {
    //     setAlerts(prev => prev.filter(a => a !== alert));
    //   }, 5000);
    // };

    // Subscribe to WebSocket events (if WebSocket context is available)
    // This would be integrated with your WebSocket context
    // window.addEventListener('period_level_update', handlePeriodUpdate);
    // window.addEventListener('level_approach', handleLevelApproach);

    return () => {
      // Cleanup listeners
      // window.removeEventListener('period_level_update', handlePeriodUpdate);
      // window.removeEventListener('level_approach', handleLevelApproach);
    };
  }, [symbol]);

  const togglePeriod = (period: string) => {
    setExpandedPeriods(prev => {
      const newSet = new Set(prev);
      if (newSet.has(period)) {
        newSet.delete(period);
      } else {
        newSet.add(period);
      }
      return newSet;
    });
  };

  const renderPeriodCard = (period: string, level: PeriodLevel | undefined) => {
    if (!level) return null;
    
    const isExpanded = expandedPeriods.has(period);
    const color = PERIOD_COLORS[period as keyof typeof PERIOD_COLORS];
    const position = currentPrice ? periodLevelsService.getPositionInRange(
      currentPrice, 
      level.high, 
      level.low
    ) : 0.5;
    
    return (
      <div 
        key={period}
        className={`period-card ${period} ${level.is_active ? 'active' : ''}`}
        style={{ borderTopColor: color }}
      >
        <div 
          className="period-header"
          onClick={() => togglePeriod(period)}
        >
          <div className="period-title">
            <span className="period-name" style={{ color }}>
              {periodLevelsService.formatPeriod(period)}
            </span>
            {level.is_active && <span className="active-badge">Active</span>}
          </div>
          <div className="period-range">
            <span className="high">{periodLevelsService.formatPrice(level.high)}</span>
            <span className="separator">-</span>
            <span className="low">{periodLevelsService.formatPrice(level.low)}</span>
          </div>
        </div>
        
        {currentPrice && (
          <div className="position-indicator">
            <div className="position-bar">
              <div 
                className="position-marker"
                style={{ 
                  left: `${position * 100}%`,
                  backgroundColor: color 
                }}
              />
            </div>
            <div className="position-text">
              Position: {(position * 100).toFixed(1)}%
            </div>
          </div>
        )}
        
        {isExpanded && (
          <div className="period-details">
            <div className="detail-row">
              <span className="detail-label">Period:</span>
              <span className="detail-value">
                {new Date(level.start_time).toLocaleDateString()} - {new Date(level.end_time).toLocaleDateString()}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Range:</span>
              <span className="detail-value">
                {periodLevelsService.formatPrice(level.high - level.low)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="period-levels-container">
        <div className="loading">Loading period levels...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="period-levels-container">
        <div className="error">{error}</div>
      </Card>
    );
  }

  if (!levels) {
    return null;
  }

  return (
    <Card className="period-levels-container">
      <div className="period-levels-header">
        <h3>Period Levels</h3>
        <span className="symbol">{symbol}</span>
      </div>
      
      {alerts.length > 0 && (
        <div className="alerts-container">
          {alerts.map((alert, index) => (
            <div 
              key={index}
              className={`alert ${alert.direction}`}
              style={{ borderLeftColor: PERIOD_COLORS[alert.period as keyof typeof PERIOD_COLORS] }}
            >
              <span className="alert-icon">⚡</span>
              <span className="alert-text">
                Price {alert.direction} {alert.period} {alert.level}
              </span>
            </div>
          ))}
        </div>
      )}
      
      <div className="periods-grid">
        {renderPeriodCard('daily', levels.daily)}
        {renderPeriodCard('weekly', levels.weekly)}
        {renderPeriodCard('monthly', levels.monthly)}
        {renderPeriodCard('yearly', levels.yearly)}
      </div>
    </Card>
  );
};