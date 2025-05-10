import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface User {
  id: number;
  username: string;
  email: string;
  name?: string;
  bio?: string;
  avatar?: string;
}

const TOKEN_KEY = 'auth_token';

export function useTokenAuth() {
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // Check local storage for token on initial load
  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      try {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        console.log('Auth status check - token data:', storedToken);
        
        if (!storedToken) {
          setUser(null);
          setToken(null);
          console.log('Auth status check - isAuthenticated:', false);
          return;
        }
        
        // Validate token by fetching user data
        console.log('Attempting to validate token with the server...');
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          console.log('Got user data from server:', userData);
          setUser(userData); // /api/auth/me directly returns user data, not wrapped in a 'user' object
          setToken(storedToken);
          console.log('Auth status check - isAuthenticated:', true);
        } else {
          // Token is invalid or expired
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
          setToken(null);
          console.log('Auth status check - isAuthenticated:', false);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  // Login function
  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      // Save token and user data
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      
      // Invalidate any cached data
      queryClient.invalidateQueries();
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, [queryClient]);
  
  // Logout function
  const logout = useCallback(() => {
    // Remove token from local storage
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    
    // Invalidate any cached data
    queryClient.invalidateQueries();
    
    // Optional: Call the logout endpoint
    fetch('/api/auth/logout', { method: 'POST' })
      .catch(error => console.error('Error during logout:', error));
  }, [queryClient]);
  
  // Get auth header for API requests
  const getAuthHeader = useCallback((): Record<string, string> => {
    return token ? { 'Authorization': `Bearer ${token}` } : { 'Authorization': '' };
  }, [token]);
  
  return {
    isAuthenticated: !!token && !!user,
    isLoading,
    user,
    token,
    login,
    logout,
    getAuthHeader
  };
}