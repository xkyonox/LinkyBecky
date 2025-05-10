import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";

export const AuthCallbackHandler = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);
  const [, params] = useRoute("/auth/callback");
  
  useEffect(() => {
    const processCallback = () => {
      try {
        // Get URL query parameters
        const searchParams = new URLSearchParams(window.location.search);
        const token = searchParams.get("token");
        const username = searchParams.get("username");
        const error = searchParams.get("error");
        
        if (error) {
          toast({
            title: "Authentication Failed",
            description: error,
            variant: "destructive"
          });
          setLocation("/");
          return;
        }
        
        if (!token) {
          toast({
            title: "Authentication Failed",
            description: "No authentication token received",
            variant: "destructive"
          });
          setLocation("/");
          return;
        }
        
        // Store token in localStorage
        localStorage.setItem("auth_token", token);
        
        if (username) {
          localStorage.setItem("username", username);
        }
        
        toast({
          title: "Authentication Successful",
          description: "You have been successfully logged in",
          variant: "default"
        });
        
        // Redirect to dashboard
        setLocation("/dashboard");
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