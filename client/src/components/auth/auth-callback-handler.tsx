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
            // First get the token from Google OAuth callback
            console.log('Getting token from Google OAuth callback...');
            console.log('Cookies before fetch:', document.cookie);
            
            // Add random query param to prevent caching
            const timestamp = Date.now();
            const tokenResponse = await fetch(`/api/auth/token?_=${timestamp}`, {
              method: 'GET',
              credentials: 'include', // Include cookies from the OAuth flow
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            });
            
            console.log('Token response status:', tokenResponse.status);
            
            if (!tokenResponse.ok) {
              const errorText = await tokenResponse.text();
              console.error('Failed to retrieve token:', tokenResponse.status, errorText);
              throw new Error(`Failed to retrieve authentication token: ${tokenResponse.status} ${errorText}`);
            }
            
            // Get the token from the response
            const tokenData = await tokenResponse.json();
            console.log('Retrieved token:', tokenData.token ? 'Token present (not shown)' : 'Token missing!');
            console.log('Retrieved user data:', tokenData.user ? 'User data present' : 'User data missing!');
            console.log('Cookies after fetch:', document.cookie);
            
            if (!tokenData.token) {
              throw new Error('No token received from authentication');
            }
            
            // Now use that token for the username update request
            console.log('Using token to update username...');
            const updateUsernameResponse = await fetch('/api/auth/update-username', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenData.token}` // Add the token here
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
                console.log('Setting auth with user and token:', data.token ? 'Token present (not shown)' : 'Token missing!');
                
                // Store token directly in localStorage as well for immediate use
                try {
                  // First set it in the auth store through the proper API
                  setAuth(data.user, data.token);
                  
                  // Then verify it was stored correctly by checking localStorage directly
                  setTimeout(() => {
                    const authStorageRaw = localStorage.getItem('auth-storage');
                    if (authStorageRaw) {
                      try {
                        const authStorage = JSON.parse(authStorageRaw);
                        const storedToken = authStorage?.state?.token;
                        console.log('Verification - token in localStorage:', storedToken ? 'Present' : 'Missing!');
                        
                        if (!storedToken) {
                          console.error('Token was not properly stored in localStorage!');
                          // As a fallback, manually store it
                          const manualStorage = {
                            state: {
                              user: data.user,
                              token: data.token,
                              isAuthenticated: true
                            },
                            version: 0
                          };
                          localStorage.setItem('auth-storage', JSON.stringify(manualStorage));
                          console.log('Manually stored token in localStorage as fallback');
                        }
                      } catch (e) {
                        console.error('Error parsing auth storage during verification:', e);
                      }
                    } else {
                      console.error('auth-storage not found in localStorage after setAuth!');
                      // Create it manually as fallback
                      const manualStorage = {
                        state: {
                          user: data.user,
                          token: data.token,
                          isAuthenticated: true
                        },
                        version: 0
                      };
                      localStorage.setItem('auth-storage', JSON.stringify(manualStorage));
                      console.log('Created auth-storage in localStorage manually');
                    }
                  }, 100);
                } catch (e) {
                  console.error('Error setting auth:', e);
                }
                
                // Now that we have the token stored, subsequent calls
                // using apiRequest will include the Authorization header
                
                // ✅ 2. Check if this is a new user and create profile if needed
                try {
                  // Use the original token from the first request (most reliable source)
                  // This avoids any issues with token storage timing
                  const token = tokenData.token || data.token;
                  
                  console.log('Checking if profile exists...');
                  console.log('Using token to check profile (first 10 chars):', token.substring(0, 10) + '...');
                  
                  // Create direct fetch call with the token for profile check
                  const profileResponse = await fetch('/api/profile', {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${token}`
                    },
                    credentials: 'include'
                  });
                  
                  // If profile doesn't exist (404), create a new one
                  if (!profileResponse.ok && profileResponse.status === 404) {
                    console.log('Creating new profile for user with username:', username);
                    
                    // Create default profile with purple background color using direct fetch
                    console.log('Creating profile with direct fetch and token in header');
                    const createProfileResponse = await fetch('/api/profile', {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` // Use the same token
                      },
                      body: JSON.stringify({
                        theme: 'default',
                        backgroundColor: '#7c3aed', // Purple default
                        textColor: '#ffffff',
                        fontFamily: 'Inter',
                        socialLinks: []
                      }),
                      credentials: 'include'
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
        
        // ✅ 3. Add a successful redirect to user profile page with better logging
        console.log('Auth callback completed successfully, redirecting...');
        setTimeout(() => {
          // If we have a username, redirect to user profile page, otherwise go to dashboard
          const username = localStorage.getItem('auth-storage') ? 
            JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.user?.username : null;
          
          if (username) {
            console.log(`Redirecting to user profile page: /@${username}`);
            setLocation(`/@${username}`);
          } else {
            console.log('No username found, redirecting to dashboard');
            setLocation('/dashboard');
          }
          
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