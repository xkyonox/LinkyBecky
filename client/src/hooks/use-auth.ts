import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useAuth() {
  const { user, token, isAuthenticated, setAuth, clearAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  // Define type for user data from session or token endpoints
  interface AuthUserData {
    id: number;
    username: string;
    email: string;
    name: string;
    bio?: string;
    avatar?: string;
    token?: string;
  }

  // Try to retrieve auth status using cookie session first, then fallback to token
  const { data: sessionData, isError: sessionError, isLoading: sessionLoading } = useQuery<AuthUserData | null>({
    queryKey: ["/api/auth/me-from-session"],
    retry: 1,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Check if token is valid only if we don't have session data
  const { data: tokenData, isError: tokenError } = useQuery<AuthUserData | null>({
    queryKey: ["/api/auth/me"],
    enabled: !!token && !sessionData && !sessionLoading,
    retry: false
  });

  useEffect(() => {
    console.log('Auth status check - session data:', sessionData);
    console.log('Auth status check - token data:', tokenData);
    console.log('Auth status check - isAuthenticated:', isAuthenticated);
    
    if (sessionData) {
      // If we have session data, use it
      console.log('Setting auth from session data');
      // Ensure we have all the required user fields
      const userData = {
        id: sessionData.id,
        username: sessionData.username,
        email: sessionData.email,
        name: sessionData.name,
        bio: sessionData.bio || "",
        avatar: sessionData.avatar || ""
      };
      setAuth(userData, sessionData.token || token || '');
      setIsLoading(false);
    } else if (token) {
      if (tokenError) {
        // Token is invalid, clear auth
        console.log('Token is invalid, clearing auth');
        clearAuth();
        setIsLoading(false);
      } else if (tokenData) {
        // Token is valid, update user data
        console.log('Setting auth from token data');
        // Ensure we have all the required user fields
        const userData = {
          id: tokenData.id,
          username: tokenData.username,
          email: tokenData.email,
          name: tokenData.name,
          bio: tokenData.bio || "",
          avatar: tokenData.avatar || ""
        };
        setAuth(userData, token);
        setIsLoading(false);
      }
    } else {
      // No token and no session data
      console.log('No token and no session data');
      setIsLoading(false);
    }
  }, [token, tokenData, tokenError, sessionData, sessionError, sessionLoading, isAuthenticated, setAuth, clearAuth]);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const response = await apiRequest("POST", "/api/auth/login", { email, password });
      const data = await response.json();
      setAuth(data.user, data.token);
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "An error occurred during login"
      };
    }
  };

  // Register function
  const register = async (userData: {
    username: string;
    email: string;
    password: string;
    name: string;
  }) => {
    try {
      const response = await apiRequest("POST", "/api/auth/register", userData);
      const data = await response.json();
      setAuth(data.user, data.token);
      return { success: true };
    } catch (error) {
      console.error("Registration error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "An error occurred during registration"
      };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      clearAuth();
      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      // Clear auth anyway
      clearAuth();
      return {
        success: true,
        error: error instanceof Error ? error.message : "An error occurred during logout"
      };
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout
  };
}
