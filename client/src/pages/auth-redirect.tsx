import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

/**
 * This component serves as a "trampoline" that loads after authentication,
 * ensures the token is properly stored, and then redirects to the dashboard.
 * It's a workaround for complex auth state updating issues.
 */
export default function AuthRedirect() {
  const { toast } = useToast();
  const [testResult, setTestResult] = useState<string | null>(null);
  
  // Function to test if token works with API
  const testAuthToken = async (token: string) => {
    try {
      console.log('Testing auth token with direct API call...');
      
      // Add cache-busting parameter and timestamp for unique request
      const timestamp = Date.now();
      const url = `/api/auth/me?_t=${timestamp}`;
      console.log(`Making request to ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      console.log('Response status:', response.status);
      
      // Log all response headers for debugging
      const allHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        allHeaders[key] = value;
      });
      console.log('Response headers:', allHeaders);
      
      if (response.ok) {
        const userData = await response.json();
        console.log('User data received from test:', userData);
        setTestResult('SUCCESS: API returned user data');
        return true;
      } else {
        const errorText = await response.text();
        console.error('API test failed:', errorText);
        setTestResult(`ERROR: API returned ${response.status} - ${errorText}`);
        return false;
      }
    } catch (error) {
      console.error('Error testing auth token:', error);
      setTestResult(`ERROR: ${error.message}`);
      return false;
    }
  };
  
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    
    console.log('Auth redirect page loaded');
    console.log('Token in local storage:', token ? `exists (length: ${token.length})` : 'missing');
    
    const redirectToDashboard = async () => {
      console.log('Preparing to redirect to dashboard...');
      
      if (token) {
        // Test if token works with API before redirecting
        const testSucceeded = await testAuthToken(token);
        console.log('Auth token test result:', testSucceeded ? 'SUCCESS' : 'FAILED');
        
        // Show success message if not already shown
        toast({
          title: "Authentication Successful",
          description: "You have been logged in successfully",
          variant: "default"
        });
      }
      
      // Force hard navigation to dashboard after a delay to allow logs to be visible
      console.log('Now redirecting to dashboard');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    };
    
    // If we have a token, test it and redirect
    if (token) {
      // Add slight delay to ensure localStorage is committed and logs are clear
      setTimeout(redirectToDashboard, 1000);
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
      }, 2000);
    }
  }, [toast]);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent border-primary" aria-label="Loading"></div>
      <p className="mt-4 text-gray-600">Completing authentication...</p>
    </div>
  );
}