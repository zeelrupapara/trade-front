import { SESSION_STORAGE_KEY } from './auth';

// Simplified PeriodLevel - only ATH/ATL for each period
export interface PeriodLevel {
  symbol: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  high: number;  // ATH for this period
  low: number;   // ATL for this period
  start_time: string;
  end_time: string;
  last_updated: string;
  is_active: boolean;
}

export interface PeriodLevelsResponse {
  symbol: string;
  asset_class: string;
  current_price?: number;
  daily?: PeriodLevel;
  weekly?: PeriodLevel;
  monthly?: PeriodLevel;
  yearly?: PeriodLevel;
  timestamp: string;
}

export interface PeriodLevelUpdate {
  type: 'new_high' | 'new_low' | 'period_boundary' | 'level_approach';
  symbol: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  level?: PeriodLevel;
  old_value?: number;
  new_value?: number;
  current_price?: number;
  timestamp: number;
}

export interface LevelApproachAlert {
  symbol: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  level: string;
  level_price: number;
  current_price: number;
  distance: number;
  distance_percent: number;
  direction: 'above' | 'below';
  timestamp: number;
}

// Color scheme for periods
export const PERIOD_COLORS = {
  daily: '#FF6B35',    // Warm Orange
  weekly: '#A020F0',   // Purple
  monthly: '#00CED1',  // Dark Turquoise
  yearly: '#FFD700',   // Gold
} as const;

// Period level opacity for charts
export const PERIOD_OPACITY = {
  daily: 0.8,
  weekly: 0.7,
  monthly: 0.6,
  yearly: 0.5,
} as const;

class PeriodLevelsService {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem(SESSION_STORAGE_KEY);
    return {
      'Content-Type': 'application/json',
      'X-Session-Token': token || '',
    };
  }

  // Get all period levels for a symbol
  async getAllPeriodLevels(symbol: string): Promise<PeriodLevelsResponse> {
    const response = await fetch(`/api/v1/levels/${symbol}/all`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch period levels: ${response.status}`);
    }
    
    return response.json();
  }

  // Get specific period level
  async getPeriodLevel(symbol: string, period: string): Promise<PeriodLevel> {
    const response = await fetch(`/api/v1/levels/${symbol}/${period}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch period level: ${response.status}`);
    }
    
    return response.json();
  }

  // Get batch levels for multiple symbols
  async getBatchLevels(symbols: string[], period?: string): Promise<Record<string, PeriodLevel>> {
    const response = await fetch('/api/v1/levels/batch', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        symbols,
        period: period || 'daily',
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch batch levels: ${response.status}`);
    }
    
    return response.json();
  }

  // Get period statistics
  async getPeriodStats(symbol: string, period: string, currentPrice?: number) {
    const params = new URLSearchParams();
    params.append('period', period);
    if (currentPrice) {
      params.append('price', currentPrice.toString());
    }
    
    const response = await fetch(`/api/v1/levels/${symbol}/stats?${params}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch period stats: ${response.status}`);
    }
    
    return response.json();
  }

  // Get near level alerts
  async getNearLevelAlerts(symbol: string, currentPrice: number, tolerance?: number) {
    const params = new URLSearchParams();
    params.append('price', currentPrice.toString());
    params.append('tolerance', (tolerance || 0.5).toString());
    
    const response = await fetch(`/api/v1/levels/${symbol}/alerts?${params}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch level alerts: ${response.status}`);
    }
    
    return response.json();
  }

  // Format price for display
  formatPrice(price: number, decimals: number = 2): string {
    return price.toFixed(decimals);
  }

  // Calculate position in range (0-1)
  getPositionInRange(currentPrice: number, high: number, low: number): number {
    if (high === low) return 0.5;
    const position = (currentPrice - low) / (high - low);
    return Math.max(0, Math.min(1, position));
  }

  // Get color for period
  getPeriodColor(period: keyof typeof PERIOD_COLORS): string {
    return PERIOD_COLORS[period];
  }

  // Get opacity for period
  getPeriodOpacity(period: keyof typeof PERIOD_OPACITY): number {
    return PERIOD_OPACITY[period];
  }

  // Check if price is near ATH or ATL
  isNearLevel(price: number, level: number, tolerance: number = 0.002): boolean {
    const distance = Math.abs(price - level);
    return distance <= price * tolerance;
  }

  // Format period for display
  formatPeriod(period: string): string {
    return period.charAt(0).toUpperCase() + period.slice(1);
  }
}

export const periodLevelsService = new PeriodLevelsService();