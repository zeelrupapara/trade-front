// Binary protocol decoder for ultra-low latency market data

// Message types matching backend
export const MessageTypes = {
  PRICE_UPDATE: 0x0001,
  ENIGMA_UPDATE: 0x0002,
  SESSION_CHANGE: 0x0003,
  MARKET_WATCH: 0x0004,
  HEARTBEAT: 0x0005,
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
  timestamp: number;
}

export interface EnigmaData {
  symbol: string;
  level: number;
  ath: number;
  atl: number;
  fibLevels: {
    l0: number;
    l236: number;
    l382: number;
    l50: number;
    l618: number;
    l786: number;
    l100: number;
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

      // Read price data (8 bytes each)
      const price = view.getFloat64(offset, true);
      offset += 8;
      
      const bid = view.getFloat64(offset, true);
      offset += 8;
      
      const ask = view.getFloat64(offset, true);
      offset += 8;
      
      const volume = view.getFloat64(offset, true);

      return {
        symbol,
        price,
        bid,
        ask,
        volume,
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

        prices.push({
          symbol,
          price,
          bid,
          ask,
          volume,
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

      // Read fibonacci levels
      const fibLevels = {
        l0: view.getFloat64(offset, true),
        l236: view.getFloat64(offset + 8, true),
        l382: view.getFloat64(offset + 16, true),
        l50: view.getFloat64(offset + 24, true),
        l618: view.getFloat64(offset + 32, true),
        l786: view.getFloat64(offset + 40, true),
        l100: view.getFloat64(offset + 48, true),
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
          type: 'enigma',
          data: this.decodeEnigmaUpdate(data),
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