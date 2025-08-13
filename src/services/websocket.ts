import { SESSION_STORAGE_KEY } from './auth';
import { BinaryDecoder } from '../utils/binaryProtocol';
import { WS_CONFIG } from '../constants';

export interface WebSocketConfig {
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  enableBinary?: boolean;
  debug?: boolean;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: number;
}

export interface MarketTick {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: number;
  // 24hr change data
  change24h?: number;
  changePercent?: number;
  open24h?: number;
  high24h?: number;
  low24h?: number;
}

export interface EnigmaData {
  symbol: string;
  level: number;
  ath: number;
  atl: number;
  asset_class?: 'crypto' | 'forex' | 'stock' | 'commodity' | 'index';
  data_source?: string;
  fib_levels: {
    '0': number;
    '23.6': number;
    '38.2': number;
    '50': number;
    '61.8': number;
    '78.6': number;
    '100': number;
  };
  timestamp: string;
}

// Period Levels WebSocket Types
export interface PeriodLevelUpdate {
  type: 'new_high' | 'new_low' | 'period_boundary' | 'level_approach';
  symbol: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  level?: any;
  old_value?: number;
  new_value?: number;
  current_price?: number;
  timestamp: number;
}

export interface PeriodBoundaryEvent {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  affected_symbols: string[];
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

export interface SymbolData {
  symbol: string;
  description: string;
  exchange: string;
  currency: string;
  bid: number;
  ask: number;
  last: number;
  price?: number;
  high?: number;
  low?: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
  // 24hr change data
  open24h?: number;
  high24h?: number;
  low24h?: number;
  change24h?: number;
  // Sync status
  sync_status?: 'pending' | 'syncing' | 'completed' | 'failed';
  sync_progress?: number;
  enigma?: EnigmaData;
}

export interface WebSocketStats {
  connected: boolean;
  reconnectAttempts: number;
  messagesSent: number;
  messagesReceived: number;
  latency: number;
  lastError?: string;
}

type MessageHandler = (message: WebSocketMessage) => void;
type ConnectionHandler = (stats: WebSocketStats) => void;
type ErrorHandler = (error: Error) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private stats: WebSocketStats = {
    connected: false,
    reconnectAttempts: 0,
    messagesSent: 0,
    messagesReceived: 0,
    latency: 0,
  };
  
  // Event handlers
  private messageHandlers = new Map<string, Set<MessageHandler>>();
  private connectionHandlers = new Set<ConnectionHandler>();
  private disconnectionHandlers = new Set<ConnectionHandler>();
  private errorHandlers = new Set<ErrorHandler>();
  
  // Connection management
  private isConnecting = false;
  private shouldReconnect = true;
  private reconnectTimer?: NodeJS.Timeout;
  private pingInterval?: NodeJS.Timeout;
  private lastPingTime = 0;
  
  // Message queue for offline handling
  private messageQueue: any[] = [];
  
  constructor(config: WebSocketConfig = {}) {
    this.config = {
      maxReconnectAttempts: config.maxReconnectAttempts || WS_CONFIG.MAX_RECONNECT_ATTEMPTS,
      reconnectDelay: config.reconnectDelay || WS_CONFIG.INITIAL_RECONNECT_DELAY,
      enableBinary: config.enableBinary !== undefined ? config.enableBinary : true,
      debug: config.debug || false,
    };
    
    this.debug('WebSocketService initialized with config:', this.config);
  }
  
  private debug(...args: any[]) {
    if (this.config.debug) {
      console.log('[WebSocket]', ...args);
    }
  }
  
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.debug('Already connected');
        resolve();
        return;
      }
      
      if (this.isConnecting) {
        this.debug('Connection already in progress');
        resolve();
        return;
      }
      
      this.isConnecting = true;
      const token = localStorage.getItem(SESSION_STORAGE_KEY);
      
      if (!token) {
        this.isConnecting = false;
        const error = new Error('No authentication token found');
        this.handleError(error);
        reject(error);
        return;
      }
      
      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.isConnecting) {
          this.isConnecting = false;
          if (this.ws) {
            this.ws.close();
            this.ws = null;
          }
          const error = new Error('WebSocket connection timeout');
          this.handleError(error);
          reject(error);
        }
      }, WS_CONFIG.CONNECTION_TIMEOUT);
      
      try {
        // Build WebSocket URL
        const wsUrl = this.buildWebSocketUrl(token);
        this.debug('Connecting to:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        
        // Set binary type if enabled
        if (this.config.enableBinary) {
          this.ws.binaryType = 'arraybuffer';
        }
        
        this.ws.onopen = () => {
          console.log('[WebSocket] Connected successfully');
          clearTimeout(connectionTimeout);
          this.isConnecting = false;
          this.stats.connected = true;
          this.stats.reconnectAttempts = 0;
          
          // Start ping/pong for latency monitoring
          this.startPingInterval();
          
          // Send queued messages
          this.sendQueuedMessages();
          
          // Notify handlers
          this.notifyConnectionHandlers();
          
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          this.stats.messagesReceived++;
          this.handleMessage(event);
        };
        
        this.ws.onerror = (event) => {
          this.debug('WebSocket error:', event);
          const error = new Error('WebSocket connection error');
          this.handleError(error);
          
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(error);
          }
        };
        
        this.ws.onclose = (event) => {
          this.debug('Disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.stats.connected = false;
          
          this.stopPingInterval();
          this.notifyDisconnectionHandlers();
          
          if (this.shouldReconnect && this.stats.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
        
      } catch (error) {
        this.isConnecting = false;
        this.handleError(error as Error);
        reject(error);
      }
    });
  }
  
  private buildWebSocketUrl(token: string): string {
    // Determine the WebSocket URL based on environment
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    
    if (isProduction) {
      // In production, use the same host as the page
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${protocol}//${host}/api/v1/ws?token=${token}`;
    } else {
      // In development, connect directly to backend
      return `ws://localhost:8080/api/v1/ws?token=${token}`;
    }
  }
  
  private handleMessage(event: MessageEvent) {
    try {
      let message: WebSocketMessage;
      
      if (event.data instanceof ArrayBuffer) {
        // Handle binary data
        message = this.decodeBinaryMessage(event.data);
      } else {
        // Handle JSON data
        message = JSON.parse(event.data);
      }
      
      // Handle ping/pong for latency
      if (message.type === 'pong') {
        this.stats.latency = Date.now() - this.lastPingTime;
        // Clear pong timeout if exists
        if ((this.pingInterval as any)?._pongTimeout) {
          clearTimeout((this.pingInterval as any)._pongTimeout);
        }
        return;
      }
      
      // Log non-price messages for debugging
      if (message.type !== 'price' && message.type !== 'pong') {
        console.log('[WebSocket] Message received:', message.type, message.data);
      }
      
      // Notify specific handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            // Error in message handler
          }
        });
      }
      
      // Notify wildcard handlers
      const wildcardHandlers = this.messageHandlers.get('*');
      if (wildcardHandlers) {
        wildcardHandlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            // Error in wildcard handler
          }
        });
      }
      
    } catch (error) {
      // Error handling message
    }
  }
  
  private decodeBinaryMessage(data: ArrayBuffer): WebSocketMessage {
    const decoded = BinaryDecoder.decode(data);
    
    if (!decoded) {
      // Failed to decode binary message
      return {
        type: 'unknown',
        data: null,
        timestamp: Date.now(),
      };
    }
    
    // Handle batch price updates specially
    if (decoded.type === 'batch_price' && Array.isArray(decoded.data)) {
      // Process each price in the batch
      decoded.data.forEach((priceData: any) => {
        if (priceData) {
          // Dispatch individual price updates
          const priceMessage = {
            type: 'price',
            data: priceData,
            timestamp: priceData.timestamp,
          };
          
          // Notify price handlers
          const handlers = this.messageHandlers.get('price');
          if (handlers) {
            handlers.forEach(handler => {
              try {
                handler(priceMessage);
              } catch (error) {
                // Error in price handler
              }
            });
          }
        }
      });
      
      // Return the batch message itself
      return {
        type: decoded.type,
        data: decoded.data,
        timestamp: Date.now(),
      };
    }
    
    return {
      type: decoded.type,
      data: decoded.data,
      timestamp: decoded.data?.timestamp || Date.now(),
    };
  }
  
  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        this.ws.send(payload);
        this.stats.messagesSent++;
        this.debug('Message sent:', message);
      } catch (error) {
        // Error sending message
        this.queueMessage(message);
      }
    } else {
      this.debug('WebSocket not connected, queueing message');
      this.queueMessage(message);
    }
  }
  
  private queueMessage(message: any) {
    // Limit queue size to prevent memory issues
    if (this.messageQueue.length >= WS_CONFIG.MESSAGE_QUEUE_MAX_SIZE) {
      console.warn('[WebSocket] Message queue full, dropping oldest message');
      this.messageQueue.shift(); // Remove oldest message
    }
    
    this.messageQueue.push(message);
    this.debug('Message queued, queue size:', this.messageQueue.length);
  }
  
  private sendQueuedMessages() {
    if (this.messageQueue.length === 0) return;
    
    this.debug('Sending', this.messageQueue.length, 'queued messages');
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    messages.forEach(message => this.send(message));
  }
  
  private startPingInterval() {
    let pongTimeout: NodeJS.Timeout | undefined;
    
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();
        this.send({ type: 'ping' });
        
        // Set timeout for pong response
        pongTimeout = setTimeout(() => {
          console.warn('[WebSocket] Pong timeout - connection may be dead');
          // Force reconnect if no pong received
          if (this.ws) {
            this.ws.close();
          }
        }, WS_CONFIG.PONG_TIMEOUT);
      }
    }, WS_CONFIG.PING_INTERVAL);
    
    // Store pong timeout cleaner
    (this.pingInterval as any)._pongTimeout = pongTimeout;
  }
  
  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }
  
  private scheduleReconnect() {
    if (!this.shouldReconnect) return;
    
    this.stats.reconnectAttempts++;
    
    // Calculate delay with exponential backoff
    const baseDelay = this.config.reconnectDelay;
    const backoffFactor = WS_CONFIG.RECONNECT_BACKOFF_FACTOR;
    const delay = Math.min(
      baseDelay * Math.pow(backoffFactor, this.stats.reconnectAttempts - 1),
      WS_CONFIG.MAX_RECONNECT_DELAY
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    const finalDelay = Math.floor(delay + jitter);
    
    this.debug(`Reconnecting in ${finalDelay}ms (attempt ${this.stats.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        this.debug('Reconnection failed:', error);
        
        // If we've exhausted all attempts, notify error handlers
        if (this.stats.reconnectAttempts >= this.config.maxReconnectAttempts) {
          this.handleError(new Error('Maximum reconnection attempts reached'));
          this.shouldReconnect = false;
        }
      });
    }, finalDelay);
  }
  
  disconnect() {
    this.debug('Disconnecting...');
    this.shouldReconnect = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.stats.connected = false;
    this.messageQueue = [];
  }
  
  // Event subscription methods
  onMessage(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    
    this.messageHandlers.get(type)!.add(handler);
    console.log(`[WebSocket] Handler registered for '${type}' (total: ${this.messageHandlers.get(type)!.size})`);
    
    // Return unsubscribe function
    return () => {
      this.offMessage(type, handler);
    };
  }
  
  offMessage(type: string, handler: MessageHandler) {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(type);
      }
      console.log(`[WebSocket] Handler removed for '${type}' (remaining: ${handlers.size})`);
    }
  }
  
  onConnect(handler: () => void): () => void {
    const wrappedHandler = () => handler();
    this.connectionHandlers.add(wrappedHandler);
    return () => this.connectionHandlers.delete(wrappedHandler);
  }
  
  onDisconnect(handler: () => void): () => void {
    const wrappedHandler = () => handler();
    this.disconnectionHandlers.add(wrappedHandler);
    return () => this.disconnectionHandlers.delete(wrappedHandler);
  }
  
  onError(handler: (error: Event) => void): () => void {
    const wrappedHandler = (error: Error) => handler(error as any);
    this.errorHandlers.add(wrappedHandler);
    return () => this.errorHandlers.delete(wrappedHandler);
  }
  
  // Notification methods
  private notifyConnectionHandlers() {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(this.stats);
      } catch (error) {
        // Error in connection handler
      }
    });
  }
  
  private notifyDisconnectionHandlers() {
    this.disconnectionHandlers.forEach(handler => {
      try {
        handler(this.stats);
      } catch (error) {
        // Error in disconnection handler
      }
    });
  }
  
  private handleError(error: Error) {
    this.stats.lastError = error.message;
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (err) {
        // Error in error handler
      }
    });
  }
  
  // Utility methods
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  
  getStats(): WebSocketStats {
    return { ...this.stats };
  }
  
  getConnectionState(): string {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'CONNECTED';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }
  
  // Connection management
  reconnect() {
    this.debug('Manual reconnect requested');
    this.shouldReconnect = true;
    this.stats.reconnectAttempts = 0;
    
    if (this.ws) {
      this.ws.close();
    } else {
      this.connect().catch(error => {
        console.error('[WebSocket] Reconnect failed:', error);
      });
    }
  }
  
  resetConnection() {
    this.debug('Resetting connection');
    this.disconnect();
    this.shouldReconnect = true;
    this.stats.reconnectAttempts = 0;
    this.messageQueue = [];
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('[WebSocket] Reset connection failed:', error);
      });
    }, 1000);
  }
  
  // Market data helpers
  subscribe(channel: string) {
    this.send({
      type: 'subscribe',
      channel: channel
    });
  }

  unsubscribe(channel: string) {
    this.send({
      type: 'unsubscribe',
      channel: channel
    });
  }
  
  subscribeToSymbols(symbols: string[]) {
    this.send({
      type: 'subscribe',
      symbols: symbols,
    });
  }
  
  unsubscribeFromSymbols(symbols: string[]) {
    this.send({
      type: 'unsubscribe',
      symbols: symbols,
    });
  }
  
  subscribeToSymbol(symbol: string) {
    this.send({
      type: 'subscribe',
      symbols: [symbol],
    });
  }
  
  unsubscribeFromSymbol(symbol: string) {
    this.send({
      type: 'unsubscribe',
      symbols: [symbol],
    });
  }
  
  // Note: Market watch subscription is handled automatically by the backend
  // when connecting with a session token. No manual request is needed.
}

// Create singleton instance with binary protocol enabled
export const websocketService = new WebSocketService({
  debug: false,
  maxReconnectAttempts: WS_CONFIG.MAX_RECONNECT_ATTEMPTS,
  reconnectDelay: WS_CONFIG.INITIAL_RECONNECT_DELAY,
  enableBinary: true, // Enable binary protocol for ultra-low latency
});

// Debug exposure disabled in production
// if (process.env.NODE_ENV === 'development') {
//   (window as any).websocketService = websocketService;
// }