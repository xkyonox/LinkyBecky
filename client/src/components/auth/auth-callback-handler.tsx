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
    const handleCallback = async () => {
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
        
        // Redirect to dashboard
        setLocation('/dashboard');
      } catch (error) {
        console.error('Error in auth callback:', error);
        toast({
          variant: 'destructive',
          title: 'Authentication error',
          description: 'There was a problem completing your login. Please try again.',
        });
        setLocation('/');
      }
    };

    handleCallback();
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