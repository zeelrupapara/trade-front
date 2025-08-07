// Enigma Indicator Implementation for TradingView Chart
import { websocketService } from '../../services/websocket';
import { useMarketStore } from '../../stores/marketStore';

export interface EnigmaData {
  symbol: string;
  level: number;
  ath: number;
  atl: number;
  current_price?: number;
  fib_levels: {
    [key: string]: number;
  };
  timestamp: string;
}

// Store shape IDs for cleanup
let enigmaShapes: any[] = [];
let currentChart: any = null;
let currentSymbol: string = '';

export function addEnigmaIndicator(chart: any, symbol: string) {
  // Skip if chart is not ready
  if (!chart || !symbol) {
    console.log('[Enigma] Chart or symbol not ready:', { chart: !!chart, symbol });
    return;
  }
  
  console.log('[Enigma] Initializing for symbol:', symbol);
  
  // Store references
  currentChart = chart;
  currentSymbol = symbol;
  
  // Clear existing Enigma shapes
  clearEnigmaShapes();
  
  // Get symbol data from store to check if Enigma data exists
  const symbolData = useMarketStore.getState().symbols.get(symbol);
  console.log('[Enigma] Symbol data from store:', symbolData?.enigma ? 'Has Enigma' : 'No Enigma');
  
  if (symbolData?.enigma) {
    console.log('[Enigma] Drawing initial levels, Enigma level:', symbolData.enigma.level);
    drawEnigmaLevels(chart, symbolData.enigma);
  }
  
  // Subscribe to real-time Enigma updates
  const unsubscribe = websocketService.onMessage('enigma_update', (message) => {
    if (message.data && message.data.symbol === symbol) {
      console.log('[Enigma] Received update for', symbol, 'Level:', message.data.level);
      drawEnigmaLevels(chart, message.data);
    }
  });
  
  // Store unsubscribe function on chart for cleanup
  if (chart._enigmaUnsubscribe) {
    chart._enigmaUnsubscribe();
  }
  chart._enigmaUnsubscribe = unsubscribe;
}

function drawEnigmaLevels(chart: any, enigmaData: any) {
  if (!chart || !enigmaData) {
    console.log('[Enigma] Missing chart or data');
    return;
  }
  
  // Clear existing lines first
  clearEnigmaShapes();
  
  try {
    const fibLevels = enigmaData.fib_levels || enigmaData.fibLevels;
    if (!fibLevels) {
      console.log('[Enigma] No fib_levels found in data');
      return;
    }
    
    console.log('[Enigma] Drawing levels, current level:', enigmaData.level);
    console.log('[Enigma] Available Fibonacci levels:', Object.keys(fibLevels));
    
    // Define all Fibonacci levels with colors
    const levels = [
      { key: '0', label: 'ATL (0%)', color: '#ef4444', lineWidth: 2, lineStyle: 0 },    // Red - ATL
      { key: '23.6', label: '23.6%', color: '#f97316', lineWidth: 1, lineStyle: 2 },    // Orange - dotted
      { key: '38.2', label: '38.2%', color: '#f59e0b', lineWidth: 1, lineStyle: 2 },    // Amber - dotted
      { key: '50', label: '50%', color: '#3b82f6', lineWidth: 2, lineStyle: 0 },        // Blue - solid
      { key: '61.8', label: '61.8%', color: '#8b5cf6', lineWidth: 1, lineStyle: 2 },    // Purple - dotted
      { key: '78.6', label: '78.6%', color: '#a855f7', lineWidth: 1, lineStyle: 2 },    // Purple - dotted
      { key: '100', label: 'ATH (100%)', color: '#10b981', lineWidth: 2, lineStyle: 0 } // Green - ATH
    ];
    
    // Draw each Fibonacci level
    levels.forEach(level => {
      const price = fibLevels[level.key];
      if (!price || price <= 0) return;
      
      try {
        // Create horizontal line using createPositionLine or createShape
        if (chart.createPositionLine) {
          // Use position line API if available
          const line = chart.createPositionLine()
            .setText(`Enigma ${level.label}`)
            .setPrice(price)
            .setQuantity('')
            .setBodyFont('11px monospace')
            .setBodyTextColor(level.color)
            .setLineColor(level.color)
            .setLineStyle(level.lineStyle)
            .setLineLength(85)  // Extend line across more of the chart
            .setLineWidth(level.lineWidth);
          
          enigmaShapes.push(line);
          console.log('[Enigma] Created position line at', price, 'for', level.label);
        } else if (chart.createShape) {
          // Fallback to shape API
          const shapeId = chart.createShape(
            { price: price },
            {
              shape: 'horizontal_line',
              lock: true,
              disableSelection: true,
              disableSave: true,
              disableUndo: true,
              zOrder: 'bottom',  // Put behind price candles
              overrides: {
                linecolor: level.color,
                linewidth: level.lineWidth,
                linestyle: level.lineStyle,
                showLabel: true,
                text: `Enigma ${level.label}`,
                fontsize: 11,
                textcolor: level.color,
                transparency: 20  // Less transparent for better visibility
              }
            }
          );
          
          if (shapeId) {
            enigmaShapes.push(shapeId);
          }
        } else if (chart.createMultipointShape) {
          // Alternative: Use multipoint shape for horizontal line
          const points = [
            { time: Math.floor(Date.now() / 1000) - 86400 * 30, price: price },
            { time: Math.floor(Date.now() / 1000) + 86400 * 30, price: price }
          ];
          
          const shapeId = chart.createMultipointShape(points, {
            shape: 'trend_line',
            lock: true,
            disableSelection: true,
            disableSave: true,
            overrides: {
              linecolor: level.color,
              linewidth: level.lineWidth,
              linestyle: level.lineStyle,
              showLabel: true,
              text: level.label,
              fontsize: 10,
              textcolor: level.color
            }
          });
          
          if (shapeId) {
            enigmaShapes.push(shapeId);
          }
        }
      } catch (error) {
        console.debug(`Could not draw Enigma level ${level.label}:`, error);
      }
    });
    
    // Add current Enigma level indicator
    if (enigmaData.level !== undefined) {
      addEnigmaLevelIndicator(chart, enigmaData.level);
    }
    
    // Add a text overlay showing current Enigma percentage
    if (enigmaData.level !== undefined && enigmaData.level !== null) {
      console.log(`[Enigma] Levels drawn for ${currentSymbol}: ${enigmaData.level.toFixed(1)}%`);
    }
  } catch (error) {
    console.error('[Enigma] Error drawing levels:', error);
  }
}

function addEnigmaLevelIndicator(chart: any, level: number) {
  if (!chart) return;
  
  try {
    const color = getEnigmaColor(level);
    const text = `Enigma: ${level.toFixed(1)}%`;
    
    // Try to add text note or annotation
    if (chart.createStudy) {
      // Add as a study/indicator text
      const studyId = chart.createStudy('Text', false, false, {
        text: text,
        color: color,
        fontsize: 12,
        transparency: 0
      });
      
      if (studyId) {
        enigmaShapes.push(studyId);
      }
    }
  } catch (error) {
    console.debug('Could not add Enigma level indicator:', error);
  }
}

function clearEnigmaShapes() {
  if (!currentChart) return;
  
  enigmaShapes.forEach(shape => {
    try {
      if (shape && shape.remove) {
        // For position lines
        shape.remove();
      } else if (currentChart.removeEntity) {
        // For shapes
        currentChart.removeEntity(shape);
      } else if (currentChart.removeStudy) {
        // For studies
        currentChart.removeStudy(shape);
      }
    } catch (error) {
      // Shape might already be removed
    }
  });
  
  enigmaShapes = [];
}

// Removed unused formatPrice function - prices are shown directly by TradingView

function getEnigmaColor(level: number): string {
  if (level < 20) return '#ef4444';      // Red - Oversold
  if (level < 40) return '#f59e0b';      // Orange
  if (level < 60) return '#3b82f6';      // Blue - Neutral
  if (level < 80) return '#8b5cf6';      // Purple
  return '#10b981';                       // Green - Overbought
}

// Export cleanup function
export function removeEnigmaIndicator() {
  clearEnigmaShapes();
  
  if (currentChart && currentChart._enigmaUnsubscribe) {
    currentChart._enigmaUnsubscribe();
    delete currentChart._enigmaUnsubscribe;
  }
  
  currentChart = null;
  currentSymbol = '';
}