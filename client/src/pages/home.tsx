import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const [username, setUsername] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();

  // Store username in sessionStorage to retrieve after login
  useEffect(() => {
    const storedUsername = sessionStorage.getItem("pendingUsername");
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  const validateUsername = (value: string) => {
    return /^[a-zA-Z0-9_]{3,20}$/.test(value);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setUsername(value);
    setUsernameMessage({ type: null, message: "" });
  };

  const checkUsernameAvailability = async () => {
    if (!username) {
      setUsernameMessage({
        type: "error",
        message: "Please enter a username."
      });
      return false;
    }

    if (!validateUsername(username)) {
      setUsernameMessage({
        type: "error",
        message: "Username must be 3-20 characters and only contain letters, numbers, and underscores."
      });
      return false;
    }

    setIsChecking(true);
    
    try {
      console.log(`🔍 Checking availability for username: ${username}`);
      
      const response = await fetch(`/api/username/availability/${username}`, {
        credentials: 'include', // Add this to ensure cookies are sent
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      // Log detailed response information
      console.log(`✅ Username check response status: ${response.status}`);
      
      // Log response headers safely
      const headerObj: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headerObj[key] = value;
      });
      console.log(`✅ Response headers:`, headerObj);
      
      // Check if the response is successful
      if (!response.ok) {
        console.error(`❌ Username availability check failed with status: ${response.status}`);
        const errorText = await response.text();
        console.error(`❌ Error response: ${errorText}`);
        throw new Error(`Server error: ${response.status}`);
      }
      
      // Parse response as JSON
      let data;
      try {
        data = await response.json();
        console.log('✅ Username check response data:', data);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError);
        const rawText = await response.clone().text();
        console.error('Raw response text:', rawText);
        throw new Error('Invalid response format');
      }
      
      setUsernameMessage({
        type: data.available ? "success" : "error",
        message: data.message
      });
      
      return data.available;
    } catch (error) {
      console.error('❌ Username availability check error:', error);
      
      setUsernameMessage({
        type: "error",
        message: "Error checking username. Please try again."
      });
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  const handleClaimPage = async () => {
    console.log("Checking username availability for:", username);
    
    // First hit the status endpoint to verify basic connectivity and cookies
    try {
      console.log("Step 1: Testing basic API connectivity");
      const statusResponse = await fetch('/api/status', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      console.log("Status API response status:", statusResponse.status);
      const statusData = await statusResponse.json();
      console.log("Status API response:", statusData);

      // Test database connection
      console.log("Step 2: Testing database connectivity");
      const dbResponse = await fetch('/api/test-db', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      console.log("DB Test response status:", dbResponse.status);
      if (dbResponse.ok) {
        const dbData = await dbResponse.json();
        console.log("Database test result:", dbData);
      } else {
        console.error("Database test failed:", await dbResponse.text());
        toast({
          title: "Database Error",
          description: "There was a problem connecting to the database. Please try again later.",
          variant: "destructive"
        });
        return;
      }
      
      // Try a direct raw access to username endpoint
      console.log("Step 3: Testing direct URL access to username endpoint");
      const rawResponse = await fetch(`/api/username/availability/${username}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      console.log("Raw username check status:", rawResponse.status);
      if (rawResponse.ok) {
        try {
          const rawData = await rawResponse.json();
          console.log("Raw username check result:", rawData);
        } catch (e) {
          console.error("Error parsing raw username check response:", e);
        }
      }
      
    } catch (error) {
      console.error("Error checking API status or DB:", error);
      toast({
        title: "Connection Error",
        description: "There was a problem connecting to the server. Please try again later.",
        variant: "destructive"
      });
      return;
    }
    
    // Now proceed with normal username check through our function
    console.log("Step 4: Checking username availability through normal function");
    const isAvailable = await checkUsernameAvailability();
    console.log("Username availability result:", isAvailable);
    
    if (isAvailable) {
      // Store the username in sessionStorage to retrieve after OAuth
      sessionStorage.setItem("pendingUsername", username);
      console.log("Stored username in sessionStorage:", username);
      
      // Redirect to Google OAuth
      window.location.href = "/api/auth/google";
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-violet-500 text-transparent bg-clip-text">
              LinkyBecky
            </h1>
          </div>
          <div>
            {user?.id ? (
              <Button asChild variant="default">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex flex-col items-center justify-center p-6 bg-gradient-to-b from-primary/10 to-background">
        <div className="max-w-3xl w-full mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary to-violet-500 text-transparent bg-clip-text">
              LinkyBecky
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground">
              Build with AI. Share Your Story.
            </p>
          </div>

          <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg border border-border">
            <div className="space-y-4">
              <div className="space-y-2 text-center">
                <h2 className="text-lg font-bold truncate">LinkyBecky: Where Your Story Begins</h2>
                <p className="text-muted-foreground">
                  Pick a Name for Your Page
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center">
                  <span className="bg-muted px-3 py-2 rounded-l-md border-y border-l border-input">
                    @
                  </span>
                  <Input
                    id="username"
                    value={username}
                    onChange={handleUsernameChange}
                    placeholder="Hannes_Did_It_Again"
                    className="rounded-l-none"
                    disabled={isChecking}
                  />
                </div>
                
                {usernameMessage.type && (
                  <Alert variant={usernameMessage.type === "error" ? "destructive" : "default"}>
                    <AlertDescription>
                      {usernameMessage.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Button 
                className="w-full"
                disabled={isChecking || !username} 
                onClick={handleClaimPage}
                size="lg"
              >
                Claim Your Page
              </Button>
              
              {/* Auth Test Button (only for development) */}
              <div className="pt-4 border-t mt-4">
                <p className="text-xs text-muted-foreground mb-2">Developer Testing</p>
                <div className="flex space-x-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => window.location.href = "/api/auth/google"}
                  >
                    Test Google Login
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => window.location.href = "/auth/redirect"}
                  >
                    Test Auth Redirect
                  </Button>
                </div>
                
                {/* Quick Login Button using test token */}
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs"
                  onClick={async () => {
                    try {
                      // Get a test token from the server
                      const response = await fetch('/api/auth/test-token', {
                        method: 'GET',
                        headers: {
                          'Cache-Control': 'no-cache, no-store, must-revalidate',
                          'Pragma': 'no-cache'
                        }
                      });
                      
                      if (!response.ok) {
                        throw new Error(`Test token API failed: ${response.status}`);
                      }
                      
                      const data = await response.json();
                      console.log('✅ Got test token:', data);
                      
                      // Save token to localStorage
                      if (data.token) {
                        localStorage.setItem('auth_token', data.token);
                        console.log('✅ Saved token to localStorage');
                        
                        // Redirect to dashboard
                        toast({
                          title: 'Quick Login Successful',
                          description: `Logged in as ${data.user.username}`,
                          variant: 'default'
                        });
                        
                        // Redirect after a brief delay
                        setTimeout(() => {
                          window.location.href = '/dashboard';
                        }, 1000);
                      }
                    } catch (error) {
                      console.error('❌ Quick login error:', error);
                      toast({
                        title: 'Quick Login Failed',
                        description: error instanceof Error ? error.message : 'Unknown error',
                        variant: 'destructive'
                      });
                    }
                  }}
                >
                  Quick Login (Test Admin)
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} LinkyBecky. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}