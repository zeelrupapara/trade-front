import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { websocketService } from '../services/websocket';
import { useAuthStore } from '../stores/authStore';

interface WebSocketContextType {
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
});

export const useWebSocket = () => useContext(WebSocketContext);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { isAuthenticated } = useAuthStore();
  const [isConnected, setIsConnected] = React.useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      // Connect and set up handlers
      websocketService.connect().catch(() => {
        // Connection error handled by error handler
      });
      
      // Set up connection handlers
      const unsubscribeConnect = websocketService.onConnect(() => {
        setIsConnected(true);
      });
      
      const unsubscribeDisconnect = websocketService.onDisconnect(() => {
        setIsConnected(false);
      });
      
      const unsubscribeError = websocketService.onError(() => {
        // Errors handled internally
      });
      
      return () => {
        unsubscribeConnect();
        unsubscribeDisconnect();
        unsubscribeError();
        websocketService.disconnect();
      };
    }
  }, [isAuthenticated]);

  return (
    <WebSocketContext.Provider value={{ isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}