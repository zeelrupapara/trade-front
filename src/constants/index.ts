// WebSocket Configuration
export const WS_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5,
  INITIAL_RECONNECT_DELAY: 1000, // 1 second
  MAX_RECONNECT_DELAY: 30000, // 30 seconds
  RECONNECT_BACKOFF_FACTOR: 2,
  PING_INTERVAL: 30000, // 30 seconds
  PONG_TIMEOUT: 5000, // 5 seconds
  MESSAGE_QUEUE_MAX_SIZE: 1000,
  CONNECTION_TIMEOUT: 10000, // 10 seconds
} as const;

// TradingView Configuration
export const TV_CONFIG = {
  LIBRARY_PATH: '/tradingview/charting_library/',
  DEFAULT_INTERVAL: '1D',
  DEFAULT_TIMEZONE: 'Etc/UTC',
  DEFAULT_LOCALE: 'en',
  PRICE_SCALE: {
    CRYPTO: 100000,
    FOREX: 10000,
    STOCK: 100,
  },
  SUPPORTED_RESOLUTIONS: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
  MAX_BARS_BACK: 300,
  DATAFEED_RETRY_ATTEMPTS: 3,
  DATAFEED_RETRY_DELAY: 1000,
} as const;

// Market Data Configuration
export const MARKET_CONFIG = {
  PRICE_UPDATE_THROTTLE: 100, // milliseconds
  WATCHLIST_MAX_SIZE: 50,
  PRICE_DECIMAL_PLACES: 5,
  VOLUME_DECIMAL_PLACES: 2,
  PRICE_ANIMATION_DURATION: 300, // milliseconds
  CACHE_CLEANUP_INTERVAL: 300000, // 5 minutes
  MAX_CACHE_AGE: 3600000, // 1 hour
} as const;

// API Configuration
export const API_CONFIG = {
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  BATCH_SIZE: 50,
} as const;

// Resolution to milliseconds mapping
export const RESOLUTION_TO_MS: Record<string, number> = {
  '1': 60 * 1000,
  '5': 5 * 60 * 1000,
  '15': 15 * 60 * 1000,
  '30': 30 * 60 * 1000,
  '60': 60 * 60 * 1000,
  '240': 4 * 60 * 60 * 1000,
  'D': 24 * 60 * 60 * 1000,
  'W': 7 * 24 * 60 * 60 * 1000,
  'M': 30 * 24 * 60 * 60 * 1000,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  AUTH_ERROR: 'Authentication failed. Please login again.',
  SYMBOL_NOT_FOUND: 'Symbol not found.',
  DATA_LOAD_ERROR: 'Failed to load data. Please try again.',
  WS_CONNECTION_ERROR: 'Failed to connect to real-time data.',
  INVALID_DATA_FORMAT: 'Received invalid data format.',
} as const;