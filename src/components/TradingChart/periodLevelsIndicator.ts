// Period Levels Indicator Implementation for TradingView Chart
import { websocketService } from '../../services/websocket';
import { periodLevelsService, PERIOD_COLORS } from '../../services/periodLevels';
import type { PeriodLevelUpdate } from '../../services/periodLevels';

// Store shape IDs for cleanup
interface PeriodShapes {
  daily: any[];
  weekly: any[];
  monthly: any[];
  yearly: any[];
}

let periodShapes: PeriodShapes = {
  daily: [],
  weekly: [],
  monthly: [],
  yearly: []
};

let currentChart: any = null;
let wsUnsubscribe: (() => void) | null = null;

export async function addPeriodLevelsIndicator(chart: any, symbol: string) {
  // Skip if chart is not ready
  if (!chart || !symbol) {
    console.log('[PeriodLevels] Chart or symbol not ready:', { chart: !!chart, symbol });
    return;
  }
  
  console.log('[PeriodLevels] Initializing for symbol:', symbol);
  
  // Store references
  currentChart = chart;
  
  // Clear existing period shapes
  clearPeriodShapes();
  
  // Try to fetch period levels data from API
  try {
    const levelsData = await periodLevelsService.getAllPeriodLevels(symbol);
    console.log('[PeriodLevels] Fetched data for', symbol);
    
    // Draw levels for each period
    if (levelsData.daily) {
      drawPeriodLevel(chart, 'daily', levelsData.daily);
    }
    if (levelsData.weekly) {
      drawPeriodLevel(chart, 'weekly', levelsData.weekly);
    }
    if (levelsData.monthly) {
      drawPeriodLevel(chart, 'monthly', levelsData.monthly);
    }
    if (levelsData.yearly) {
      drawPeriodLevel(chart, 'yearly', levelsData.yearly);
    }
  } catch (error) {
    console.error('[PeriodLevels] Could not fetch data from API:', error);
  }
  
  // Subscribe to real-time period level updates
  if (wsUnsubscribe) {
    wsUnsubscribe();
  }
  
  wsUnsubscribe = websocketService.onMessage('period_level_update', (message) => {
    const update = message.data as PeriodLevelUpdate;
    if (update && update.symbol === symbol) {
      console.log('[PeriodLevels] Received update for', symbol, 'Period:', update.period);
      
      // Clear shapes for the updated period
      clearPeriodShapesForPeriod(update.period);
      
      // Redraw with new level
      if (update.level) {
        drawPeriodLevel(chart, update.period, update.level);
      }
    }
  });
  
  // Also listen for period boundary events (new day/week/month)
  const boundaryUnsubscribe = websocketService.onMessage('period_boundary', (_message) => {
    console.log('[PeriodLevels] Period boundary event, refreshing levels');
    // Refresh all levels when a new period starts
    addPeriodLevelsIndicator(chart, symbol);
  });
  
  // Store unsubscribe functions on chart for cleanup
  if (chart._periodLevelsUnsubscribe) {
    chart._periodLevelsUnsubscribe();
  }
  chart._periodLevelsUnsubscribe = () => {
    if (wsUnsubscribe) wsUnsubscribe();
    boundaryUnsubscribe();
  };
}

function drawPeriodLevel(chart: any, period: string, levelData: any) {
  if (!chart || !levelData) {
    console.log('[PeriodLevels] Missing chart or data for', period);
    return;
  }
  
  try {
    const color = PERIOD_COLORS[period as keyof typeof PERIOD_COLORS];
    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
    
    console.log(`[PeriodLevels] Drawing ${period} ATH/ATL - High: ${levelData.high}, Low: ${levelData.low}`);
    
    // Draw ATH line for this period
    const highLine = createHorizontalLine(chart, {
      price: levelData.high,
      label: `${periodLabel} ATH`,
      color: color,
      lineWidth: period === 'daily' ? 2 : 1,
      lineStyle: 0, // Solid line
      opacity: period === 'daily' ? 100 : 80
    });
    
    if (highLine) {
      periodShapes[period as keyof PeriodShapes].push(highLine);
    }
    
    // Draw ATL line for this period
    const lowLine = createHorizontalLine(chart, {
      price: levelData.low,
      label: `${periodLabel} ATL`,
      color: color,
      lineWidth: period === 'daily' ? 2 : 1,
      lineStyle: 0, // Solid line
      opacity: period === 'daily' ? 100 : 80
    });
    
    if (lowLine) {
      periodShapes[period as keyof PeriodShapes].push(lowLine);
    }
    
    console.log(`[PeriodLevels] Successfully drew ${period} ATH/ATL lines`);
    
  } catch (error) {
    console.error(`[PeriodLevels] Error drawing ${period} levels:`, error);
  }
}

function createHorizontalLine(chart: any, options: {
  price: number;
  label: string;
  color: string;
  lineWidth: number;
  lineStyle: number;
  opacity?: number;
}) {
  try {
    // Try different methods to create horizontal lines
    if (chart.createPositionLine) {
      // Use position line API (preferred method)
      const line = chart.createPositionLine()
        .setText(options.label)
        .setPrice(options.price)
        .setQuantity('')
        .setBodyFont('10px monospace')
        .setBodyTextColor(options.color)
        .setLineColor(options.color)
        .setLineStyle(options.lineStyle)
        .setLineLength(75)  // Extend line across chart
        .setLineWidth(options.lineWidth);
      
      console.log(`[PeriodLevels] Created position line at ${options.price} for ${options.label}`);
      return line;
      
    } else if (chart.createShape) {
      // Fallback to shape API
      const transparency = options.opacity ? (100 - options.opacity) : 0;
      const shapeId = chart.createShape(
        { price: options.price },
        {
          shape: 'horizontal_line',
          lock: true,
          disableSelection: true,
          disableSave: true,
          disableUndo: true,
          zOrder: 'bottom',  // Put behind price candles
          overrides: {
            linecolor: options.color,
            linewidth: options.lineWidth,
            linestyle: options.lineStyle,
            showLabel: true,
            text: options.label,
            fontsize: 10,
            textcolor: options.color,
            transparency: transparency
          }
        }
      );
      
      if (shapeId) {
        console.log(`[PeriodLevels] Created shape at ${options.price} for ${options.label}`);
      }
      return shapeId;
      
    } else if (chart.createMultipointShape) {
      // Alternative: Use multipoint shape for horizontal line
      const points = [
        { time: Math.floor(Date.now() / 1000) - 86400 * 30, price: options.price },
        { time: Math.floor(Date.now() / 1000) + 86400 * 30, price: options.price }
      ];
      
      const shapeId = chart.createMultipointShape(points, {
        shape: 'trend_line',
        lock: true,
        disableSelection: true,
        disableSave: true,
        overrides: {
          linecolor: options.color,
          linewidth: options.lineWidth,
          linestyle: options.lineStyle,
          showLabel: true,
          text: options.label,
          fontsize: 10,
          textcolor: options.color,
          transparency: options.opacity ? (100 - options.opacity) : 0
        }
      });
      
      if (shapeId) {
        console.log(`[PeriodLevels] Created multipoint shape at ${options.price} for ${options.label}`);
      }
      return shapeId;
    }
  } catch (error) {
    console.debug(`Could not create line for ${options.label}:`, error);
  }
  
  return null;
}

function clearPeriodShapesForPeriod(period: string) {
  if (!currentChart || !periodShapes[period as keyof PeriodShapes]) return;
  
  const shapes = periodShapes[period as keyof PeriodShapes];
  shapes.forEach(shape => {
    try {
      if (shape && shape.remove) {
        // For position lines
        shape.remove();
      } else if (currentChart.removeEntity) {
        // For shapes
        currentChart.removeEntity(shape);
      }
    } catch (error) {
      // Shape might already be removed
    }
  });
  
  periodShapes[period as keyof PeriodShapes] = [];
}

function clearPeriodShapes() {
  if (!currentChart) return;
  
  // Clear all period shapes
  Object.keys(periodShapes).forEach(period => {
    clearPeriodShapesForPeriod(period);
  });
}

// Export cleanup function
export function removePeriodLevelsIndicator() {
  clearPeriodShapes();
  
  if (currentChart && currentChart._periodLevelsUnsubscribe) {
    currentChart._periodLevelsUnsubscribe();
    delete currentChart._periodLevelsUnsubscribe;
  }
  
  if (wsUnsubscribe) {
    wsUnsubscribe();
    wsUnsubscribe = null;
  }
  
  currentChart = null;
}