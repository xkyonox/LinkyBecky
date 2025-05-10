import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store";

export function useAuth() {
  const { user: tokenUser, token, isAuthenticated: isTokenAuth, setAuth, clearAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  
  // Check session-based authentication
  const { 
    data: sessionData,
    isLoading: isSessionLoading,
    error: sessionError
  } = useQuery({ 
    queryKey: ['/api/auth/me-from-session'],
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    console.log("Auth status check - session data:", sessionData?.user);
    console.log("Auth status check - token data:", tokenUser);
    console.log("Auth status check - isAuthenticated:", isTokenAuth || !!sessionData?.isAuthenticated);

    if (!tokenUser && !token && sessionData?.isAuthenticated && sessionData.user) {
      console.log("Found authenticated session but no token - syncing auth store");
      // User is authenticated via session but not via token, sync the auth store
      setAuth(sessionData.user, "");
    } else if (!sessionData?.isAuthenticated && tokenUser) {
      console.log("No token and no session data");
      // Session is not authenticated but token exists, clear token
      clearAuth();
    }

    setIsLoading(false);
  }, [sessionData, tokenUser, token, isTokenAuth, setAuth, clearAuth]);
  
  return {
    user: tokenUser || (sessionData?.isAuthenticated ? sessionData.user : null),
    token,
    isLoading: isLoading || isSessionLoading,
    isAuthenticated: isTokenAuth || !!sessionData?.isAuthenticated,
    error: sessionError,
  };
}