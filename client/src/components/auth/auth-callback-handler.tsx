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
        // ✅ 1. Get the username from sessionStorage BEFORE clearing it
        const username = sessionStorage.getItem('pendingUsername');
        console.log('Retrieved username from sessionStorage:', username);

        if (username) {
          // For the initial API call to update username, we can't use apiRequest directly
          // since we don't have the token yet. We need to make a direct fetch call.
          console.log('Making direct fetch call to /api/auth/update-username with username:', username);
          
          try {
            const updateUsernameResponse = await fetch('/api/auth/update-username', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ username }),
              credentials: 'include' // Include cookies
            });
            
            console.log('Update username response status:', updateUsernameResponse.status);
            
            if (updateUsernameResponse.ok) {
              // Parse the response to get the token and user info
              const data = await updateUsernameResponse.json();
              console.log('Successfully updated username, received token and user data');
              
              if (data.user && data.token) {
                // Store the token and user info in the auth store
                console.log('Setting auth with user and token');
                setAuth(data.user, data.token);
                
                // Now that we have the token stored in the auth store, subsequent calls
                // using apiRequest will include the Authorization header
                
                // ✅ 2. Check if this is a new user and create profile if needed
                try {
                  console.log('Checking if profile exists...');
                  // Try to get existing profile - this will now use the token from auth store
                  const profileResponse = await apiRequest('GET', '/api/profile');
                  
                  // If profile doesn't exist (404), create a new one
                  if (!profileResponse.ok && profileResponse.status === 404) {
                    console.log('Creating new profile for user with username:', username);
                    
                    // Create default profile with purple background color
                    const createProfileResponse = await apiRequest('PUT', '/api/profile', {
                      theme: 'default',
                      backgroundColor: '#7c3aed', // Purple default
                      textColor: '#ffffff',
                      fontFamily: 'Inter',
                      socialLinks: []
                    });
                    
                    // ✅ Improved error handling for profile creation
                    if (!createProfileResponse.ok) {
                      const profileError = await createProfileResponse.json();
                      console.error('Error creating initial profile:', profileError);
                      throw new Error(`Profile creation failed: ${profileError.message || 'Unknown error'}`);
                    } else {
                      console.log('Profile created successfully');
                    }
                  } else if (profileResponse.ok) {
                    console.log('User already has a profile, no need to create one');
                  }
                } catch (profileError) {
                  console.error('Error handling profile creation:', profileError);
                  
                  // Show more specific error for profile creation failure
                  toast({
                    variant: 'destructive',
                    title: 'Profile Setup Error',
                    description: 'There was an issue setting up your profile. Please try again or contact support.',
                  });
                  
                  // Continue with redirect to dashboard even if profile creation fails
                  // The profile can be created later if needed
                }
                
                toast({
                  title: 'Welcome to LinkyBecky!',
                  description: `Your page @${username} has been claimed successfully.`,
                });
              } else {
                console.error('Response missing user or token:', data);
                throw new Error('Invalid response from server: missing user or token');
              }
            } else {
              // Handle error response
              let errorMessage = 'Failed to update username. Please try again.';
              try {
                const errorData = await updateUsernameResponse.json();
                errorMessage = errorData.message || errorMessage;
                console.error('Error updating username:', errorData);
              } catch (e) {
                console.error('Could not parse error response:', e);
              }
              
              toast({
                variant: 'destructive',
                title: 'Error updating username',
                description: errorMessage,
              });
              
              // If username update fails, still redirect to home
              setTimeout(() => {
                setLocation('/');
                isProcessingCallback = false;
              }, 300);
              
              return;
            }
          } catch (error) {
            console.error('Exception during username update:', error);
            toast({
              variant: 'destructive',
              title: 'Authentication Error',
              description: 'There was a problem completing your login. Please try again.',
            });
            
            setTimeout(() => {
              setLocation('/');
              isProcessingCallback = false;
            }, 300);
            
            return;
          }
        }
        
        // ✅ 3. Add a successful redirect to dashboard with better logging
        console.log('Auth callback completed successfully, redirecting to dashboard...');
        setTimeout(() => {
          // Redirect to dashboard
          setLocation('/dashboard');
          
          // Only clear the pendingUsername AFTER successfully redirecting
          setTimeout(() => {
            sessionStorage.removeItem('pendingUsername');
            console.log('Cleared pendingUsername from sessionStorage');
            isProcessingCallback = false;
          }, 100);
        }, 300);
      } catch (error) {
        // ✅ Improved error logging and handling
        console.error('Error in auth callback:', error);
        
        // Show more specific error message based on the error
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'There was a problem completing your login. Please try again.';
        
        toast({
          variant: 'destructive',
          title: 'Authentication error',
          description: errorMessage,
        });
        
        // Add a small delay before redirect to home
        setTimeout(() => {
          setLocation('/');
          sessionStorage.removeItem('pendingUsername');
          isProcessingCallback = false;
        }, 300);
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