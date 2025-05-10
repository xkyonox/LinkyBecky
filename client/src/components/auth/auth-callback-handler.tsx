import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";

export const AuthCallbackHandler = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);
  const [, params] = useRoute("/auth/callback");
  
  useEffect(() => {
    const processCallback = async () => {
      console.log("Auth callback handler triggered");
      console.log("Current URL:", window.location.href);
      console.log("URL pathname:", window.location.pathname);
      console.log("URL search params:", window.location.search);
      
      try {
        // Extract URL query parameters 
        const searchParams = new URLSearchParams(window.location.search);
        const urlToken = searchParams.get("token");
        const urlUsername = searchParams.get("username");
        const urlError = searchParams.get("error");
        const urlState = searchParams.get("state");
        
        console.log("URL params:", { 
          token: urlToken ? "FOUND" : "NOT FOUND", 
          username: urlUsername || "NONE", 
          error: urlError || "NONE",
          state: urlState ? "FOUND" : "NONE" 
        });
        
        // Check if there was a clientState stored before redirect
        const storedState = localStorage.getItem("oauth_state");
        if (storedState && urlState) {
          console.log("Checking state parameter match...");
          if (storedState !== urlState) {
            console.warn("State parameter mismatch - possible CSRF attempt");
            toast({
              title: "Security Warning",
              description: "Authentication state mismatch detected",
              variant: "destructive"
            });
          } else {
            console.log("State parameter verified ✓");
          }
          // Clean up state parameter
          localStorage.removeItem("oauth_state");
        }
        
        // Handle error
        if (urlError) {
          console.error("Authentication error:", urlError);
          toast({
            title: "Authentication Failed",
            description: urlError.replace(/\+/g, ' '),
            variant: "destructive"
          });
          setLocation("/");
          return;
        }
        
        // Handle successful authentication with token
        if (urlToken) {
          // Store the token in localStorage for subsequent API requests
          console.log("Found token in URL parameters (length):", urlToken.length);
          localStorage.setItem("auth_token", urlToken);
          
          // Store the username if provided
          if (urlUsername) {
            console.log("Storing username:", urlUsername);
            localStorage.setItem("username", urlUsername);
          }
          
          toast({
            title: "Authentication Successful",
            description: "You have been successfully logged in",
            variant: "default"
          });
          
          // Redirect to auth-redirect page which will handle the dashboard redirect
          console.log("Scheduling redirect to auth-redirect page...");
          console.log("Token stored in localStorage:", localStorage.getItem('auth_token'));
          
          // Immediately redirect to our auth-redirect page (trampoline)
          console.log("Now redirecting to auth-redirect page...");
          window.location.href = "/auth/redirect";
          return;
        }
        
        // If no token in URL, try to extract from the current page
        // This handles the case where the token is in response body from the Google OAuth flow
        try {
          // Extract data from the current page body if it contains JSON
          const bodyText = document.body.textContent || "";
          if (bodyText.includes('"token"')) {
            const jsonMatch = bodyText.match(/\{.*\}/);
            if (jsonMatch) {
              const responseData = JSON.parse(jsonMatch[0]);
              console.log("Found auth data in page body:", responseData);
              
              if (responseData.token) {
                // Store token in localStorage
                localStorage.setItem("auth_token", responseData.token);
                
                if (responseData.user?.username) {
                  localStorage.setItem("username", responseData.user.username);
                }
                
                toast({
                  title: "Authentication Successful",
                  description: "You have been successfully logged in",
                  variant: "default"
                });
                
                // Redirect to dashboard
                setLocation("/dashboard");
                return;
              }
            }
          }
        } catch (jsonError) {
          console.error("Error parsing JSON from body:", jsonError);
        }
        
        // If we got here, no token was found
        toast({
          title: "Authentication Failed",
          description: "No authentication token received",
          variant: "destructive"
        });
        setLocation("/");
      } catch (error) {
        console.error("Error processing authentication callback:", error);
        toast({
          title: "Authentication Error",
          description: "There was a problem processing your login",
          variant: "destructive"
        });
        setLocation("/");
      } finally {
        setIsProcessing(false);
      }
    };
    
    if (window.location.pathname === "/auth/callback") {
      processCallback();
    }
  }, [setLocation, toast]);
  
  if (isProcessing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent border-primary" aria-label="Loading"></div>
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    );
  }
  
  return null;
};