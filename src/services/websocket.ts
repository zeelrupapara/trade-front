import { SESSION_STORAGE_KEY } from './auth';
import { BinaryDecoder } from '../utils/binaryProtocol';

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
}

export interface SymbolData {
  symbol: string;
  description: string;
  exchange: string;
  currency: string;
  bid: number;
  ask: number;
  last: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
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
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      reconnectDelay: config.reconnectDelay || 3000,
      enableBinary: config.enableBinary || true, // Enable binary by default
      debug: config.debug || false,
    };
    
    this.debug('WebSocketService initialized with config:', this.config);
  }
  
  private debug(...args: any[]) {
    // Debug logging disabled in production
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
          this.debug('Connected successfully');
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
    // Always use the backend directly, no proxy
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = 'localhost:8080';
    return `${protocol}//${host}/api/v1/ws?token=${token}`;
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
        return;
      }
      
      this.debug('Message received:', message.type, message.data);
      
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
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();
        this.send({ type: 'ping' });
      }
    }, 30000); // Ping every 30 seconds
  }
  
  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }
  
  private scheduleReconnect() {
    this.stats.reconnectAttempts++;
    const delay = this.config.reconnectDelay * Math.min(this.stats.reconnectAttempts, 3);
    
    this.debug(`Reconnecting in ${delay}ms (attempt ${this.stats.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        this.debug('Reconnection failed:', error);
      });
    }, delay);
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
      type: 'subscribe_symbols',
      symbols: symbols,
    });
  }
  
  unsubscribeFromSymbols(symbols: string[]) {
    this.send({
      type: 'unsubscribe_symbols',
      symbols: symbols,
    });
  }
  
  subscribeToSymbol(symbol: string) {
    this.send({
      type: 'subscribe_symbol',
      symbol: symbol,
    });
  }
  
  unsubscribeFromSymbol(symbol: string) {
    this.send({
      type: 'unsubscribe_symbol',
      symbol: symbol,
    });
  }
  
  requestMarketWatch() {
    this.send({
      type: 'get_market_watch'
    });
  }
}

// Create singleton instance with binary protocol enabled
export const websocketService = new WebSocketService({
  debug: false,
  maxReconnectAttempts: 5,
  reconnectDelay: 3000,
  enableBinary: true, // Enable binary protocol for ultra-low latency
});

// Debug exposure disabled in production