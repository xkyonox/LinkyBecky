import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "./contexts/auth-context";
import { AuthProvider } from "./contexts/auth-context";
import React from "react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/profile";
import AuthRedirect from "@/pages/auth-redirect";
import { AuthCallbackHandler } from "@/components/auth/auth-callback-handler";

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
}

// Auth protected route wrapper
interface ProtectedRouteProps {
  component: React.ComponentType<any>;
}

function ProtectedRoute({ component: Component }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  return isAuthenticated ? <Component /> : <Redirect to="/" />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Show loading spinner while checking authentication status
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  // Define route components based on auth state
  const renderDashboardRoute = () => isAuthenticated ? <Dashboard /> : <Redirect to="/" />;
  const renderHomeRoute = () => isAuthenticated ? <Dashboard /> : <Home />;
  
  return (
    <Switch>
      <Route path="/login">
        <Redirect to="/" />
      </Route>
      
      <Route path="/dashboard">
        {renderDashboardRoute()}
      </Route>
      
      <Route path="/@:username">
        {(params) => <Profile username={params.username} />}
      </Route>
      
      <Route path="/auth/callback" component={AuthCallbackHandler} />
      
      {/* New trampoline route for authentication redirects */}
      <Route path="/auth/redirect" component={AuthRedirect} />
      
      <Route path="/">
        {renderHomeRoute()}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
