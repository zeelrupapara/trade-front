// Enigma Indicator Implementation
import { websocketService } from '../../services/websocket';

export interface EnigmaData {
  symbol: string;
  level: number;
  ath: number;
  atl: number;
  current_price: number;
  fib_levels: {
    [key: string]: number;
  };
  timestamp: string;
}

let enigmaLineId: string | null = null;
let fibLinesIds: string[] = [];

export function addEnigmaIndicator(chart: any, symbol: string) {
  // Skip enigma indicator if chart is not ready
  if (!chart || !symbol) return;

  // Fetch Enigma data from API
  fetchEnigmaData(symbol).then((enigmaData) => {
    if (enigmaData) {
      drawEnigmaLine(chart, enigmaData);
    }
  }).catch(error => {
    // Silently handle errors - enigma data might not be available for all symbols
    console.debug(`Enigma data not available for ${symbol}`);
  });

  // Subscribe to real-time Enigma updates
  const unsubscribe = websocketService.onMessage('enigma', (message) => {
    if (message.data && message.data.symbol === symbol) {
      updateEnigmaLine(chart, message.data);
    }
  });

  // Store unsubscribe function on chart for cleanup
  if (chart._enigmaUnsubscribe) {
    chart._enigmaUnsubscribe();
  }
  chart._enigmaUnsubscribe = unsubscribe;
}

async function fetchEnigmaData(symbol: string): Promise<EnigmaData | null> {
  try {
    const response = await fetch(`/api/v1/symbols/${symbol}/enigma`);
    if (!response.ok) {
      throw new Error('Failed to fetch Enigma data');
    }
    return await response.json();
  } catch (error) {
    // Error fetching Enigma data
    return null;
  }
}

function drawEnigmaLine(chart: any, enigmaData: EnigmaData) {
  if (!chart || !enigmaData) return;

  // Remove existing lines
  removeExistingLines(chart);

  try {
    // Calculate price level from Enigma percentage
    const priceLevel = calculateEnigmaPriceLevel(enigmaData);

    // For TradingView, we need to use createMultipointShape or createStudy instead of createShape
    // Since the chart might not support horizontal lines directly, we'll skip drawing for now
    // This prevents the "Value is null" error
    
    // TODO: Implement proper enigma indicator as a custom study when TradingView library is available
    console.debug(`Enigma level for ${enigmaData.symbol}: ${enigmaData.level.toFixed(2)}%`);

    // Draw Fibonacci levels - also skip for now to prevent errors
    // drawFibonacciLevels(chart, enigmaData);
  } catch (error) {
    console.error('Error drawing Enigma line:', error);
  }
}

function drawFibonacciLevels(chart: any, enigmaData: EnigmaData) {
  if (!chart || !enigmaData || !enigmaData.fib_levels) return;
  
  const fibLevels = ['0', '23.6', '38.2', '50', '61.8', '78.6', '100'];
  
  fibLevels.forEach((level) => {
    try {
      if (enigmaData.fib_levels[level] && chart.createShape) {
        const lineId = chart.createShape(
          { time: Date.now() / 1000 },
          {
            shape: 'horizontal_line',
            overrides: {
              linecolor: getFibColor(parseFloat(level)),
              linewidth: 1,
              linestyle: 2, // Dashed line
              showLabel: true,
              text: `Fib ${level}%`,
              textcolor: '#888888',
              fontsize: 10,
            },
          }
        );
        if (lineId) {
          fibLinesIds.push(lineId);
        }
      }
    } catch (error) {
      console.error(`Error drawing Fibonacci level ${level}:`, error);
    }
  });
}

function updateEnigmaLine(chart: any, enigmaData: EnigmaData) {
  // Remove old lines and draw new ones
  drawEnigmaLine(chart, enigmaData);
}

function removeExistingLines(chart: any) {
  if (!chart || !chart.removeEntity) return;
  
  if (enigmaLineId) {
    try {
      chart.removeEntity(enigmaLineId);
    } catch (e) {
      // Error removing enigma line
    }
    enigmaLineId = null;
  }

  fibLinesIds.forEach((id) => {
    try {
      chart.removeEntity(id);
    } catch (e) {
      // Error removing fib line
    }
  });
  fibLinesIds = [];
}

function calculateEnigmaPriceLevel(enigmaData: EnigmaData): number {
  const range = enigmaData.ath - enigmaData.atl;
  return enigmaData.atl + (range * enigmaData.level / 100);
}

function getEnigmaColor(level: number): string {
  if (level < 20) return '#ef4444';      // Red - Oversold
  if (level < 40) return '#f97316';      // Orange
  if (level < 60) return '#eab308';      // Yellow - Neutral
  if (level < 80) return '#84cc16';      // Light Green
  return '#22c55e';                       // Green - Overbought
}

function getFibColor(level: number): string {
  if (level === 0) return '#ef4444';
  if (level <= 23.6) return '#f97316';
  if (level <= 38.2) return '#f59e0b';
  if (level <= 50) return '#eab308';
  if (level <= 61.8) return '#84cc16';
  if (level <= 78.6) return '#22c55e';
  return '#10b981';
}