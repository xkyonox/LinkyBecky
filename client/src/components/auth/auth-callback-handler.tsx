import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuthStore } from '@/lib/store';

export function AuthCallbackHandler() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    // Keep track of whether we've already processed the callback
    let isProcessingCallback = false;

    const handleCallback = async () => {
      // Prevent multiple simultaneous executions
      if (isProcessingCallback) return;
      isProcessingCallback = true;

      try {
        // Get the username from sessionStorage
        const username = sessionStorage.getItem('pendingUsername');
        console.log('Retrieved username from sessionStorage:', username);

        if (username) {
          // Call the API to update username
          const response = await apiRequest('POST', '/api/auth/update-username', { username });
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.user && data.token) {
              // Update auth state with user data
              setAuth(data.user, data.token);
              
              // Check if this is a new user and create profile if needed
              try {
                // Try to get existing profile
                const profileResponse = await apiRequest('GET', '/api/profile');
                
                // If profile doesn't exist (404), create a new one
                if (!profileResponse.ok && profileResponse.status === 404) {
                  console.log('Creating new profile for user with username:', username);
                  
                  // Create default profile with random purple background color
                  const createProfileResponse = await apiRequest('POST', '/api/profile', {
                    theme: 'default',
                    backgroundColor: '#7c3aed', // Purple default
                    textColor: '#ffffff',
                    fontFamily: 'Inter',
                    socialLinks: []
                  });
                  
                  if (!createProfileResponse.ok) {
                    console.error('Error creating initial profile:', await createProfileResponse.json());
                  }
                }
              } catch (profileError) {
                console.error('Error handling profile creation:', profileError);
                // Continue with the flow even if profile creation fails
              }
            }

            toast({
              title: 'Welcome to LinkyBecky!',
              description: `Your page @${username} has been claimed successfully.`,
            });
          } else {
            const errorData = await response.json();
            toast({
              variant: 'destructive',
              title: 'Error updating username',
              description: errorData.message || 'Failed to update username. Please try again.',
            });
          }
        }

        // Clear the stored username
        sessionStorage.removeItem('pendingUsername');
        
        // Always redirect to dashboard after auth (even without username update)
        // Add a small delay before redirect to ensure state is updated
        setTimeout(() => {
          console.log('Redirecting to dashboard...');
          // Redirect to dashboard
          setLocation('/dashboard');
          isProcessingCallback = false;
        }, 300);
      } catch (error) {
        console.error('Error in auth callback:', error);
        toast({
          variant: 'destructive',
          title: 'Authentication error',
          description: 'There was a problem completing your login. Please try again.',
        });
        
        // Add a small delay before redirect
        setTimeout(() => {
          setLocation('/');
          isProcessingCallback = false;
        }, 100);
      }
    };

    handleCallback();

    // Cleanup function to prevent memory leaks
    return () => {
      isProcessingCallback = true; // Prevent any pending callbacks
    };
  }, [setLocation, toast, setAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Completing your login...</p>
      </div>
    </div>
  );
}