export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expires_at: string;
  user_id: string;
}

export interface SessionResponse {
  user_id: string;
  username: string;
  created_at: string;
  expires_at: string;
  valid: boolean;
}

export const SESSION_STORAGE_KEY = 'trade_session_token';

export const authService = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    const token = localStorage.getItem(SESSION_STORAGE_KEY);
    if (token) {
      try {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': token,
          },
        });
      } catch (error) {
        // Logout error
      }
    }
  },

  getSession: async (): Promise<SessionResponse> => {
    const token = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!token) {
      throw new Error('No token found');
    }

    const response = await fetch('/api/v1/auth/session', {
      method: 'GET',
      headers: {
        'X-Session-Token': token,
      },
    });

    if (!response.ok) {
      throw new Error('Invalid session');
    }

    return response.json();
  },
};