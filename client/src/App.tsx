import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/profile";
import { AuthCallbackHandler } from "@/components/auth/auth-callback-handler";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        {() => {
          // Redirect to home page - using window.location for simplicity in this case
          window.location.href = '/';
          return null;
        }}
      </Route>
      <Route path="/dashboard">
        {isAuthenticated ? <Dashboard /> : (() => {
          // Redirect to home if not authenticated
          window.location.href = '/';
          return null;
        })()}
      </Route>
      <Route path="/@:username">
        {(params) => <Profile username={params.username} />}
      </Route>
      <Route path="/auth/callback" component={AuthCallbackHandler} />
      <Route path="/">
        {isAuthenticated ? <Dashboard /> : <Home />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
