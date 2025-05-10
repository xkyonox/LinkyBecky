import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { FaGoogle } from "react-icons/fa";

export default function Home() {
  const [username, setUsername] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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
      const response = await fetch(`/api/username/availability/${username}`);
      const data = await response.json();
      
      setUsernameMessage({
        type: data.available ? "success" : "error",
        message: data.message
      });
      
      return data.available;
    } catch (error) {
      setUsernameMessage({
        type: "error",
        message: "Error checking username. Please try again."
      });
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  const handleGoogleLogin = async () => {
    const isAvailable = await checkUsernameAvailability();
    
    if (isAvailable) {
      // Store the username in sessionStorage to retrieve after OAuth
      sessionStorage.setItem("pendingUsername", username);
      
      // Redirect to Google OAuth with username as state param
      window.location.href = `/api/auth/google?username=${encodeURIComponent(username)}`;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
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
                <h2 className="text-2xl font-bold">Claim Your Page</h2>
                <p className="text-muted-foreground">
                  Choose your unique username to get started
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="flex items-center">
                  <span className="bg-muted px-3 py-2 rounded-l-md border-y border-l border-input">
                    @
                  </span>
                  <Input
                    id="username"
                    value={username}
                    onChange={handleUsernameChange}
                    placeholder="yourcoolname"
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
                onClick={handleGoogleLogin}
              >
                <FaGoogle className="mr-2" />
                Claim with Google
              </Button>
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