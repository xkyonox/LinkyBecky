import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store";

// Define session data type
interface SessionResponse {
  isAuthenticated: boolean;
  user: any | null;
  error?: string;
}

export function useAuth() {
  const { user: tokenUser, token, isAuthenticated: isTokenAuth, setAuth, clearAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  
  // Check session-based authentication
  const { 
    data: sessionData,
    isLoading: isSessionLoading,
    error: sessionError
  } = useQuery<SessionResponse>({ 
    queryKey: ['/api/auth/me-from-session'],
    retry: false,
    refetchOnWindowFocus: false,
    // Default to not authenticated if request fails
    initialData: { isAuthenticated: false, user: null } 
  });

  useEffect(() => {
    // Extract session data with proper type checking
    const sessionUser = sessionData?.user || null;
    const isSessionAuth = sessionData?.isAuthenticated || false;
    
    console.log("Auth status check - session data:", sessionUser);
    console.log("Auth status check - token data:", tokenUser);
    console.log("Auth status check - isAuthenticated:", isTokenAuth || isSessionAuth);

    if (!tokenUser && !token && isSessionAuth && sessionUser) {
      console.log("Found authenticated session but no token - syncing auth store");
      // User is authenticated via session but not via token, sync the auth store
      setAuth(sessionUser, "");
    } else if (!isSessionAuth && tokenUser) {
      console.log("No token and no session data");
      // Session is not authenticated but token exists, clear token
      clearAuth();
    }

    setIsLoading(false);
  }, [sessionData, tokenUser, token, isTokenAuth, setAuth, clearAuth]);
  
  // Safe way to extract session data
  const isSessionAuth = !!sessionData?.isAuthenticated;
  const sessionUser = sessionData?.user || null;
  
  // Logout function to handle both token and session logout
  const logout = async () => {
    // Clear token auth from store
    clearAuth();
    
    // Clear session auth by calling the logout API endpoint
    try {
      await fetch('/api/auth/logout', {
        method: 'GET',
        credentials: 'include'
      });
      
      // Invalidate the query to refresh auth state
      // Note: We don't directly import queryClient to avoid circular dependencies
      window.location.href = '/';
    } catch (error) {
      console.error("Logout error:", error);
      // Force reload to clear any client state
      window.location.href = '/';
    }
  };
  
  return {
    user: tokenUser || (isSessionAuth ? sessionUser : null),
    token,
    isLoading: isLoading || isSessionLoading,
    isAuthenticated: isTokenAuth || isSessionAuth,
    error: sessionError,
    logout
  };
}