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
  // Fetch Enigma data from API
  fetchEnigmaData(symbol).then((enigmaData) => {
    if (enigmaData) {
      drawEnigmaLine(chart, enigmaData);
    }
  });

  // Subscribe to real-time Enigma updates
  websocketService.onMessage('enigma', (message) => {
    if (message.data.symbol === symbol) {
      updateEnigmaLine(chart, message.data);
    }
  });
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
  // Remove existing lines
  removeExistingLines(chart);

  // Calculate price level from Enigma percentage
  const priceLevel = calculateEnigmaPriceLevel(enigmaData);

  // Create main Enigma horizontal line
  enigmaLineId = chart.createShape(
    { time: Date.now() / 1000 },
    {
      shape: 'horizontal_line',
      overrides: {
        linecolor: getEnigmaColor(enigmaData.level),
        linewidth: 3,
        linestyle: 0, // Solid line
        showLabel: true,
        text: `Enigma: ${enigmaData.level.toFixed(2)}%`,
        textcolor: '#ffffff',
        fontsize: 14,
      },
    }
  );

  // Draw Fibonacci levels
  drawFibonacciLevels(chart, enigmaData);
}

function drawFibonacciLevels(chart: any, enigmaData: EnigmaData) {
  const fibLevels = ['0', '23.6', '38.2', '50', '61.8', '78.6', '100'];
  
  fibLevels.forEach((level) => {
    if (enigmaData.fib_levels[level]) {
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
      fibLinesIds.push(lineId);
    }
  });
}

function updateEnigmaLine(chart: any, enigmaData: EnigmaData) {
  // Remove old lines and draw new ones
  drawEnigmaLine(chart, enigmaData);
}

function removeExistingLines(chart: any) {
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