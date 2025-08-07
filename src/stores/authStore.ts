import { create } from 'zustand';
import { authService, SESSION_STORAGE_KEY, type LoginRequest, type SessionResponse } from '../services/auth';

interface AuthState {
  user: SessionResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem(SESSION_STORAGE_KEY),
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (credentials: LoginRequest) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(credentials);
      localStorage.setItem(SESSION_STORAGE_KEY, response.token);
      
      // Get user session after login
      const session = await authService.getSession();
      
      set({
        token: response.token,
        user: session,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Login failed',
        isAuthenticated: false,
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
    } catch (error) {
      // Logout error
    } finally {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem('has_configured_watchlist');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  checkSession: async () => {
    const token = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    set({ isLoading: true });
    try {
      const session = await authService.getSession();
      set({
        user: session,
        isAuthenticated: session.valid,
        isLoading: false,
        token,
      });
    } catch (error) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));