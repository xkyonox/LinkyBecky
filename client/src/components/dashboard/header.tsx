import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/store";
import { Menu, ExternalLink, LogOut, Settings, User } from "lucide-react";

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuthStore();
  const { logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    // Show loading toast
    toast({
      title: "Logging out",
      description: "Please wait...",
    });
    
    try {
      // Call the logout function from useAuth
      const result = await logout();
      
      if (result.success) {
        toast({
          title: "Logged out",
          description: "You have been successfully logged out.",
        });
        
        // Force navigation to home page
        window.location.href = '/';
      } else {
        toast({
          title: "Error",
          description: result.error || "There was an error logging out.",
          variant: "destructive",
        });
        
        // Even if there's an error, try to navigate home
        window.location.href = '/';
      }
    } catch (error) {
      console.error("Error during logout:", error);
      
      toast({
        title: "Error",
        description: "There was an unexpected error during logout.",
        variant: "destructive",
      });
      
      // Force navigation to home page even on exception
      window.location.href = '/';
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 fixed w-full z-10 h-14">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link href="/dashboard">
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-violet-500 text-transparent bg-clip-text">
                LinkyBecky
              </h1>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8 items-center">
            <Link href="/dashboard">
              <p className="text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary px-3 py-2 rounded-md text-sm font-medium cursor-pointer">
                Dashboard
              </p>
            </Link>
            <a href={`/@${user?.username}`} target="_blank" className="text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary px-3 py-2 rounded-md text-sm font-medium">
              View My Page
            </a>
          </nav>
          
          {/* User Menu */}
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="rounded-full"
                  aria-label="User menu"
                >
                  {user?.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt={user.name} 
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      {user?.name?.charAt(0) || user?.username?.charAt(0) || "U"}
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.name || user?.username}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link href="/dashboard">
                    <div className="flex items-center cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <a href={`/@${user?.username}`} target="_blank" className="flex items-center cursor-pointer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    <span>View My Page</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href="/dashboard?tab=settings">
                    <div className="flex items-center cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Mobile menu button */}
            <div className="flex items-center md:hidden ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center rounded-md text-gray-400 hover:text-primary dark:text-gray-400 dark:hover:text-primary focus:outline-none"
                aria-label="Main menu"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link href="/dashboard">
              <div className="block px-3 py-2 rounded-md text-base font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                Dashboard
              </div>
            </Link>
            <a 
              href={`/@${user?.username}`} 
              target="_blank"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              View My Page
            </a>
            <button
              onClick={handleLogout}
              className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
