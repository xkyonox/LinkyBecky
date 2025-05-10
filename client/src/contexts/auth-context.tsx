import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';

interface User {
  id: number;
  username: string;
  email: string;
  name?: string;
  bio?: string;
  avatar?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
  getAuthHeader: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  
  // Check for token in localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);
  
  // Check for token in localStorage on every render (more aggressive token checking)
  useEffect(() => {
    const checkStoredToken = () => {
      const currentStoredToken = localStorage.getItem('auth_token');
      console.log("Checking localStorage for token:", currentStoredToken ? `token exists (length: ${currentStoredToken.length})` : "no token found");
      
      // If localStorage has a token that's different from our state, update it
      if (currentStoredToken && currentStoredToken !== token) {
        console.log("Token found in localStorage differs from state - updating!");
        setToken(currentStoredToken);
      }
    };
    
    // Check immediately
    checkStoredToken();
    
    // Also set up an interval to check regularly (every 2 seconds)
    const intervalId = setInterval(checkStoredToken, 2000);
    
    return () => clearInterval(intervalId);
  }, [token]);
  
  // Fetch user data if token exists
  const { data: user, isLoading, error: userError } = useQuery<User>({
    queryKey: ['/api/auth/me'],
    enabled: !!token,
    retry: 2,
    retryDelay: 1000,
    staleTime: 60000, // 1 minute - more frequent revalidation
    // Use default queryFn from queryClient.ts, but with explicit handling for debugging
    queryFn: async () => {
      console.log('AuthContext: Fetching user data with token', token ? `(length: ${token.length})` : '(missing)');
      console.log('AuthContext: Token value:', token);
      
      try {
        // Add cache-busting parameter to prevent cached responses
        const timestamp = Date.now();
        const url = `/api/auth/me?_t=${timestamp}`;
        console.log(`AuthContext: Making request to ${url}`);
        
        // Explicitly pass the token in the authorization header
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        console.log('AuthContext: /api/auth/me response status:', response.status);
        console.log('AuthContext: Response headers:', 
          Array.from(response.headers.entries()).reduce((obj, [key, val]) => ({...obj, [key]: val}), {}));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('AuthContext: Failed to fetch user data:', errorText);
          throw new Error(`Failed to fetch user data: ${response.status} ${errorText}`);
        }
        
        const userData = await response.json();
        console.log('AuthContext: User data received:', userData);
        return userData;
      } catch (error) {
        console.error('AuthContext: Error in user fetch queryFn:', error);
        throw error;
      }
    }
  });
  
  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Login failed');
      }
      
      const data = await response.json();
      
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        setToken(data.token);
        
        // Invalidate queries to refetch with new token
        queryClient.invalidateQueries();
        return data;
      } else {
        throw new Error('No token received from server');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };
  
  const logout = async () => {
    try {
      console.log('Logging out user...');
      
      // First, try to call the server-side logout API (optional, may fail)
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        console.log('Server logout response:', response.status);
      } catch (serverLogoutError) {
        // If server logout fails, continue with client-side logout
        console.warn('Server logout failed, continuing with client-side logout:', serverLogoutError);
      }
      
      // Remove token from localStorage
      localStorage.removeItem('auth_token');
      
      // Clear state
      setToken(null);
      
      // Clear all queries in cache
      queryClient.clear();
      
      // Hard redirect to home page to ensure clean state
      window.location.href = '/';
      
      console.log('Logout completed');
    } catch (error) {
      console.error('Logout error:', error);
      
      // Even if there's an error, still clear local state
      localStorage.removeItem('auth_token');
      setToken(null);
      queryClient.clear();
    }
  };
  
  const getAuthHeader = (): Record<string, string> => {
    return token ? { 'Authorization': `Bearer ${token}` } : { 'Authorization': '' };
  };
  
  console.log('Auth status check - token data:', token);
  console.log('Auth status check - isAuthenticated:', !!token && !!user);
  console.log('Auth status check - session data:', user);
  
  // Convert empty object to null to satisfy type checking
  const safeUser = user && Object.keys(user).length > 0 ? user : null;
  
  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!token && !!safeUser,
        isLoading,
        user: safeUser,
        token,
        login,
        logout,
        getAuthHeader
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};