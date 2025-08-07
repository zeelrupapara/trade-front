// Binary protocol decoder for ultra-low latency market data

// Message types matching backend
export const MessageTypes = {
  PRICE_UPDATE: 0x0001,
  ENIGMA_UPDATE: 0x0002,
  SESSION_CHANGE: 0x0003,
  MARKET_WATCH: 0x0004,
  HEARTBEAT: 0x0005,
  SYNC_PROGRESS: 0x0006,
  SYNC_COMPLETE: 0x0007,
  SYNC_ERROR: 0x0008,
  SYMBOL_REMOVED: 0x0009,
  ERROR: 0x00FF,
  BATCH_FLAG: 0x8000,
} as const;

export interface BinaryHeader {
  type: number;
  symbolLen: number;
  timestamp: number;
}

export interface PriceData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  change24h: number;
  changePercent: number;
  open24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

export interface EnigmaData {
  symbol: string;
  level: number;
  ath: number;
  atl: number;
  fibLevels: {
    '0': number;
    '23.6': number;
    '38.2': number;
    '50': number;
    '61.8': number;
    '78.6': number;
    '100': number;
  };
  timestamp: number;
}

export class BinaryDecoder {
  private static validateChecksum(data: ArrayBuffer): boolean {
    const view = new DataView(data);
    const payloadSize = data.byteLength - 4;
    
    if (payloadSize < 8) return false;
    
    // Get expected checksum
    const expectedChecksum = view.getUint32(payloadSize, true);
    
    // Calculate actual checksum using CRC32
    const payload = new Uint8Array(data, 0, payloadSize);
    const actualChecksum = crc32(payload);
    
    return expectedChecksum === actualChecksum;
  }

  static decodePriceUpdate(data: ArrayBuffer): PriceData | null {
    try {
      if (!this.validateChecksum(data)) {
        // Checksum validation failed
        return null;
      }

      const view = new DataView(data);
      let offset = 0;

      // Read header
      const msgType = view.getUint16(offset, true);
      offset += 2;
      
      if (msgType !== MessageTypes.PRICE_UPDATE) {
        // Invalid message type for price update
        return null;
      }

      const symbolLen = view.getUint16(offset, true);
      offset += 2;
      
      const timestamp = view.getUint32(offset, true);
      offset += 4;

      // Read symbol
      const symbolBytes = new Uint8Array(data, offset, symbolLen);
      const symbol = new TextDecoder().decode(symbolBytes);
      offset += symbolLen;

      // Read price data (9 fields × 8 bytes each = 72 bytes)
      const price = view.getFloat64(offset, true);
      offset += 8;
      
      const bid = view.getFloat64(offset, true);
      offset += 8;
      
      const ask = view.getFloat64(offset, true);
      offset += 8;
      
      const volume = view.getFloat64(offset, true);
      offset += 8;
      
      const change24h = view.getFloat64(offset, true);
      offset += 8;
      
      const changePercent = view.getFloat64(offset, true);
      offset += 8;
      
      const open24h = view.getFloat64(offset, true);
      offset += 8;
      
      const high24h = view.getFloat64(offset, true);
      offset += 8;
      
      const low24h = view.getFloat64(offset, true);

      // DEBUG: Log decoded 24hr data
      console.log('Binary decoder - 24hr data:', {
        symbol,
        change24h,
        changePercent,
        open24h,
        high24h,
        low24h
      });

      return {
        symbol,
        price,
        bid,
        ask,
        volume,
        change24h,
        changePercent,
        open24h,
        high24h,
        low24h,
        timestamp: timestamp * 1000, // Convert to milliseconds
      };
    } catch (error) {
      // Error decoding price update
      return null;
    }
  }

  static decodeBatchPriceUpdate(data: ArrayBuffer): PriceData[] {
    try {
      if (!this.validateChecksum(data)) {
        // Batch checksum validation failed
        return [];
      }

      const view = new DataView(data);
      let offset = 0;
      const prices: PriceData[] = [];

      // Read header
      const msgType = view.getUint16(offset, true);
      offset += 2;
      
      if ((msgType & MessageTypes.BATCH_FLAG) === 0) {
        // Not a batch message
        return [];
      }

      const count = view.getUint16(offset, true);
      offset += 2;
      
      const timestamp = view.getUint32(offset, true);
      offset += 4;

      // Read each price update
      for (let i = 0; i < count; i++) {
        const symbolLen = view.getUint16(offset, true);
        offset += 2;

        const symbolBytes = new Uint8Array(data, offset, symbolLen);
        const symbol = new TextDecoder().decode(symbolBytes);
        offset += symbolLen;

        const price = view.getFloat64(offset, true);
        offset += 8;
        
        const bid = view.getFloat64(offset, true);
        offset += 8;
        
        const ask = view.getFloat64(offset, true);
        offset += 8;
        
        const volume = view.getFloat64(offset, true);
        offset += 8;
        
        const change24h = view.getFloat64(offset, true);
        offset += 8;
        
        const changePercent = view.getFloat64(offset, true);
        offset += 8;
        
        const open24h = view.getFloat64(offset, true);
        offset += 8;
        
        const high24h = view.getFloat64(offset, true);
        offset += 8;
        
        const low24h = view.getFloat64(offset, true);
        offset += 8;

        prices.push({
          symbol,
          price,
          bid,
          ask,
          volume,
          change24h,
          changePercent,
          open24h,
          high24h,
          low24h,
          timestamp: timestamp * 1000,
        });
      }

      return prices;
    } catch (error) {
      // Error decoding batch price update
      return [];
    }
  }

  static decodeEnigmaUpdate(data: ArrayBuffer): EnigmaData | null {
    try {
      if (!this.validateChecksum(data)) {
        // Enigma checksum validation failed
        return null;
      }

      const view = new DataView(data);
      let offset = 0;

      // Read header
      const msgType = view.getUint16(offset, true);
      offset += 2;
      
      if (msgType !== MessageTypes.ENIGMA_UPDATE) {
        // Invalid message type for enigma update
        return null;
      }

      const symbolLen = view.getUint16(offset, true);
      offset += 2;
      
      const timestamp = view.getUint32(offset, true);
      offset += 4;

      // Read symbol
      const symbolBytes = new Uint8Array(data, offset, symbolLen);
      const symbol = new TextDecoder().decode(symbolBytes);
      offset += symbolLen;

      // Read enigma data
      const level = view.getFloat64(offset, true);
      offset += 8;
      
      const ath = view.getFloat64(offset, true);
      offset += 8;
      
      const atl = view.getFloat64(offset, true);
      offset += 8;

      // Read fibonacci levels - matching the keys expected by enigmaIndicator.ts
      const fibLevels = {
        '0': view.getFloat64(offset, true),
        '23.6': view.getFloat64(offset + 8, true),
        '38.2': view.getFloat64(offset + 16, true),
        '50': view.getFloat64(offset + 24, true),
        '61.8': view.getFloat64(offset + 32, true),
        '78.6': view.getFloat64(offset + 40, true),
        '100': view.getFloat64(offset + 48, true),
      };

      return {
        symbol,
        level,
        ath,
        atl,
        fibLevels,
        timestamp: timestamp * 1000,
      };
    } catch (error) {
      // Error decoding enigma update
      return null;
    }
  }

  static decodeSyncProgress(data: ArrayBuffer): any | null {
    try {
      if (!this.validateChecksum(data)) {
        return null;
      }

      const view = new DataView(data);
      let offset = 0;

      // Read header
      const msgType = view.getUint16(offset, true);
      offset += 2;
      
      if (msgType !== MessageTypes.SYNC_PROGRESS) {
        return null;
      }

      const symbolLen = view.getUint16(offset, true);
      offset += 2;
      
      const timestamp = view.getUint32(offset, true);
      offset += 4;

      // Read symbol
      const symbolBytes = new Uint8Array(data, offset, symbolLen);
      const symbol = new TextDecoder().decode(symbolBytes);
      offset += symbolLen;

      // Read progress and totalBars
      const progress = view.getUint32(offset, true);
      offset += 4;
      
      const totalBars = view.getUint32(offset, true);

      return {
        symbol,
        progress,
        totalBars,
        status: 'syncing',
        timestamp: timestamp * 1000,
      };
    } catch (error) {
      // Error decoding sync progress
      return null;
    }
  }

  static decodeSyncComplete(data: ArrayBuffer): any | null {
    try {
      if (!this.validateChecksum(data)) {
        return null;
      }

      const view = new DataView(data);
      let offset = 0;

      // Read header
      const msgType = view.getUint16(offset, true);
      offset += 2;
      
      if (msgType !== MessageTypes.SYNC_COMPLETE) {
        return null;
      }

      const symbolLen = view.getUint16(offset, true);
      offset += 2;
      
      const timestamp = view.getUint32(offset, true);
      offset += 4;

      // Read symbol
      const symbolBytes = new Uint8Array(data, offset, symbolLen);
      const symbol = new TextDecoder().decode(symbolBytes);
      offset += symbolLen;

      // Read totalBars
      const totalBars = view.getUint32(offset, true);

      return {
        symbol,
        totalBars,
        timestamp: timestamp * 1000,
      };
    } catch (error) {
      // Error decoding sync complete
      return null;
    }
  }

  static decodeSyncError(data: ArrayBuffer): any | null {
    try {
      if (!this.validateChecksum(data)) {
        return null;
      }

      const view = new DataView(data);
      let offset = 0;

      // Read header
      const msgType = view.getUint16(offset, true);
      offset += 2;
      
      if (msgType !== MessageTypes.SYNC_ERROR) {
        return null;
      }

      const symbolLen = view.getUint16(offset, true);
      offset += 2;
      
      const timestamp = view.getUint32(offset, true);
      offset += 4;

      // Read symbol
      const symbolBytes = new Uint8Array(data, offset, symbolLen);
      const symbol = new TextDecoder().decode(symbolBytes);
      offset += symbolLen;

      // Read error message length and message
      const errorLen = view.getUint16(offset, true);
      offset += 2;
      
      const errorBytes = new Uint8Array(data, offset, errorLen);
      const errorMsg = new TextDecoder().decode(errorBytes);

      return {
        symbol,
        error: errorMsg,
        timestamp: timestamp * 1000,
      };
    } catch (error) {
      // Error decoding sync error
      return null;
    }
  }

  static decodeHeartbeat(data: ArrayBuffer): number | null {
    try {
      if (!this.validateChecksum(data)) {
        return null;
      }

      const view = new DataView(data);
      const msgType = view.getUint16(0, true);
      
      if (msgType !== MessageTypes.HEARTBEAT) {
        return null;
      }

      const timestamp = view.getUint32(4, true);
      return timestamp * 1000;
    } catch (error) {
      // Error decoding heartbeat
      return null;
    }
  }

  static getMessageType(data: ArrayBuffer): number | null {
    if (data.byteLength < 2) return null;
    const view = new DataView(data);
    return view.getUint16(0, true);
  }

  static decode(data: ArrayBuffer): any {
    const msgType = this.getMessageType(data);
    if (!msgType) return null;

    // Check for batch flag
    if (msgType & MessageTypes.BATCH_FLAG) {
      return {
        type: 'batch_price',
        data: this.decodeBatchPriceUpdate(data),
      };
    }

    switch (msgType) {
      case MessageTypes.PRICE_UPDATE:
        return {
          type: 'price',
          data: this.decodePriceUpdate(data),
        };
      
      case MessageTypes.ENIGMA_UPDATE:
        return {
          type: 'enigma_update',
          data: this.decodeEnigmaUpdate(data),
        };
      
      case MessageTypes.SYNC_PROGRESS:
        return {
          type: 'sync_progress',
          data: this.decodeSyncProgress(data),
        };
      
      case MessageTypes.SYNC_COMPLETE:
        return {
          type: 'sync_complete',
          data: this.decodeSyncComplete(data),
        };
      
      case MessageTypes.SYNC_ERROR:
        return {
          type: 'sync_error',
          data: this.decodeSyncError(data),
        };
      
      case MessageTypes.HEARTBEAT:
        return {
          type: 'heartbeat',
          data: this.decodeHeartbeat(data),
        };
      
      default:
        // Unknown message type
        return null;
    }
  }
}

// Simple CRC32 implementation for checksum validation
function crc32(data: Uint8Array): number {
  const polynomial = 0xEDB88320;
  let crc = 0xFFFFFFFF;

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ polynomial;
      } else {
        crc >>>= 1;
      }
    }
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}