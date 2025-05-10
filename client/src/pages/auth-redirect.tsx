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
      setTestResult(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
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
  
  // Function to manually create a test token for debugging purposes
  const createTestToken = () => {
    const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImlhdCI6MTcxNjg5MDAwMCwiZXhwIjoxNzE3NDk0ODAwfQ.8IOFL9WPpbcE8mfGbgVlnYllOdXeIt0tGQeC9gVXy7Y';
    
    // Store the token
    localStorage.setItem('auth_token', testToken);
    
    // Set state and show message
    setTestResult('INFO: Test token created and stored in localStorage');
    
    // Test the token
    setTimeout(() => {
      testAuthToken(testToken);
    }, 500);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent border-primary" aria-label="Loading"></div>
      <p className="mt-4 text-gray-600">Completing authentication...</p>
      
      {/* Display test result if available */}
      {testResult && (
        <div className={`mt-6 p-4 rounded-md max-w-lg ${
          testResult.startsWith('SUCCESS') ? 'bg-green-100 text-green-800' : 
          testResult.startsWith('INFO') ? 'bg-blue-100 text-blue-800' : 
          'bg-red-100 text-red-800'
        }`}>
          {testResult}
        </div>
      )}
      
      {/* Developer tools - only visible when no token is present */}
      {!localStorage.getItem('auth_token') && (
        <div className="mt-8 p-4 border rounded-md bg-gray-50">
          <p className="text-sm text-muted-foreground mb-2">Developer Testing Tools</p>
          <div className="flex flex-col space-y-2">
            <button 
              onClick={createTestToken}
              className="px-4 py-2 bg-gray-200 rounded-md text-sm hover:bg-gray-300 transition-colors"
            >
              Create Test Token
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-red-100 rounded-md text-sm hover:bg-red-200 transition-colors"
            >
              Cancel &amp; Return Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}