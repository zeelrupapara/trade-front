import { SESSION_STORAGE_KEY } from './auth';

export interface Symbol {
  id: number;
  symbol: string;
  exchange: string;
  full_name: string;
  instrument_type: string;
  base_currency: string;
  quote_currency: string;
  is_active: boolean;
  min_price_increment: number;
  min_quantity_increment: number;
}

export interface SymbolsResponse {
  symbols: Symbol [];
    count: number;
}

export const symbolsService = {
  async getAllSymbols(filters?: {
    exchange?: string;
    type?: string;
    active?: boolean;
  }): Promise<SymbolsResponse> {
    try {
      const params = new URLSearchParams();
      if (filters?.exchange) params.append('exchange', filters.exchange);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.active !== undefined) params.append('active', String(filters.active));

      const url = `/api/v1/symbols${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Session-Token': localStorage.getItem(SESSION_STORAGE_KEY) || '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch symbols');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching symbols:', error);
      return {
        symbols: [],
        count: 0,
      };
    }
  },
};