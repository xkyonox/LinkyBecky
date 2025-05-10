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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  
  // Check for token in localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);
  
  // Fetch user data if token exists
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['/api/auth/me'],
    enabled: !!token,
    retry: false,
    staleTime: 300000, // 5 minutes
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
  
  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    
    // Clear all queries in cache
    queryClient.clear();
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