import React, { createContext, useContext, ReactNode } from 'react';
import { useTokenAuth } from '../hooks/use-token-auth';

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

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  token: null,
  login: async () => ({}),
  logout: () => {},
  getAuthHeader: () => ({})
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useTokenAuth();
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};