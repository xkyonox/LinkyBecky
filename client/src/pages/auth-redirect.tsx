import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

/**
 * This component serves as a "trampoline" that loads after authentication,
 * ensures the token is properly stored, and then redirects to the dashboard.
 * It's a workaround for complex auth state updating issues.
 */
export default function AuthRedirect() {
  const { toast } = useToast();
  
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    
    console.log('Auth redirect page loaded');
    console.log('Token in local storage:', token ? `exists (length: ${token.length})` : 'missing');
    
    const redirectToDashboard = () => {
      console.log('Redirecting to dashboard from auth-redirect page');
      
      // Show success message if not already shown
      toast({
        title: "Authentication Successful",
        description: "You have been logged in successfully",
        variant: "default"
      });
      
      // Force hard navigation to dashboard
      window.location.href = '/dashboard';
    };
    
    // If we have a token, redirect
    if (token) {
      // Add slight delay to ensure localStorage is committed and token is processed
      setTimeout(redirectToDashboard, 500);
    } else {
      // No token found - something went wrong. Redirect to home
      console.error('No auth token found in auth-redirect page');
      toast({
        title: "Authentication Failed",
        description: "No authentication token found",
        variant: "destructive"
      });
      
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    }
  }, [toast]);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent border-primary" aria-label="Loading"></div>
      <p className="mt-4 text-gray-600">Completing authentication...</p>
    </div>
  );
}