import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useAuth() {
  const { user, token, isAuthenticated, setAuth, clearAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  // Check if token is valid on mount
  const { data, isError } = useQuery({
    queryKey: ["/api/auth/me"],
    enabled: !!token,
    retry: false
  });

  useEffect(() => {
    if (token) {
      if (isError) {
        // Token is invalid, clear auth
        clearAuth();
        setIsLoading(false);
      } else if (data) {
        // Token is valid, update user data
        setAuth(data, token);
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [token, data, isError, setAuth, clearAuth]);

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
