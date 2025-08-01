export const config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
  WS_BASE_URL: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/api/v1/ws',
  APP_NAME: 'Trade Front',
  SESSION_STORAGE_KEY: 'trade_session_token',
};