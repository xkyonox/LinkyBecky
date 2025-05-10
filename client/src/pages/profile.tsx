import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  recordLinkClick, 
  formatNumber, 
  copyToClipboard, 
  getContrastColor
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QrCode } from "@/components/preview/qr-code";
import { UserProfile, Link } from "@/types";
import { ExternalLink, Copy } from "lucide-react";

interface ProfileProps {
  username: string;
}

export default function Profile({ username }: ProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Use the proper public profile endpoint that returns user, profile, and links data
        // This endpoint doesn't require authentication
        const response = await fetch(`/api/username/${username}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("User not found");
          }
          throw new Error("Failed to fetch profile");
        }
        
        const data = await response.json();
        console.log('Profile data fetched:', data);
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error("Error fetching profile:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (username) {
      fetchProfile();
    }
  }, [username]);

  const handleLinkClick = async (link: Link) => {
    try {
      // Get basic device info for analytics
      const userAgent = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const browser = /Chrome/i.test(userAgent) 
        ? "Chrome" 
        : /Firefox/i.test(userAgent) 
          ? "Firefox" 
          : /Safari/i.test(userAgent) 
            ? "Safari" 
            : "Other";
            
      // Record the click
      await recordLinkClick(link.id, {
        device: isMobile ? "Mobile" : "Desktop",
        browser,
        country: "Unknown" // Could use a geolocation API in a production app
      });
      
      // Redirect to the URL
      window.open(link.shortUrl || link.url, "_blank");
    } catch (error) {
      console.error("Error recording click:", error);
      // Still redirect even if recording fails
      window.open(link.shortUrl || link.url, "_blank");
    }
  };

  const handleCopyProfileUrl = async () => {
    const url = `${window.location.origin}/@${username}`;
    const success = await copyToClipboard(url);
    
    if (success) {
      toast({
        title: "URL copied",
        description: "Profile URL copied to clipboard"
      });
    } else {
      toast({
        title: "Failed to copy",
        description: "Could not copy the URL to clipboard",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Skeleton Header */}
        <div className="h-48 bg-primary-100">
          <Skeleton className="h-full w-full" />
        </div>
        
        {/* Skeleton Profile */}
        <div className="px-4 flex flex-col items-center -mt-16">
          <Skeleton className="h-32 w-32 rounded-full border-4 border-white" />
          <Skeleton className="h-6 w-48 mt-4" />
          <Skeleton className="h-4 w-64 mt-2" />
          
          {/* Skeleton Social Links */}
          <div className="flex space-x-2 mt-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-8 rounded-full" />
            ))}
          </div>
          
          {/* Skeleton Links */}
          <div className="w-full max-w-md mt-8 space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error === "User not found" ? "Profile Not Found" : "Error"}
          </h1>
          <p className="text-gray-600 mb-6">
            {error === "User not found" 
              ? `We couldn't find a profile for @${username}`
              : "There was a problem loading this profile. Please try again later."}
          </p>
          <Button
            onClick={() => window.location.href = "/"}
            className="bg-primary text-white"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const textColor = profile.profile.textColor || "#ffffff";
  const backgroundColor = profile.profile.backgroundColor || "#7c3aed";
  const fontFamily = profile.profile.fontFamily || "Inter";
  const contrastColor = getContrastColor(backgroundColor);

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ fontFamily }}
    >
      {/* Profile Header */}
      <div 
        className="flex flex-col items-center pt-10 pb-6 px-4"
        style={{ 
          backgroundColor, 
          color: textColor
        }}
      >
        <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-white">
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.name} className="h-full w-full object-cover" />
          ) : (
            <div 
              className="h-full w-full flex items-center justify-center text-2xl font-bold"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              {profile.name?.charAt(0) || profile.username?.charAt(0) || "?"}
            </div>
          )}
        </div>
        <h1 className="text-xl font-bold mt-4">{profile.name}</h1>
        {profile.bio && (
          <p className="opacity-90 text-sm mt-1 text-center max-w-md">{profile.bio}</p>
        )}
        
        {/* Social Icons */}
        {profile.profile.socialLinks && profile.profile.socialLinks.length > 0 && (
          <div className="flex space-x-3 mt-4">
            {profile.profile.socialLinks.map((social, index) => (
              <a 
                key={index} 
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 w-8 rounded-full bg-white bg-opacity-20 flex items-center justify-center hover:bg-opacity-30 transition-all"
                aria-label={`${social.platform} profile`}
              >
                <i className={`fab fa-${social.platform}`} style={{ color: textColor }}></i>
              </a>
            ))}
          </div>
        )}
      </div>
      
      {/* Links */}
      <div className="flex-1 bg-gray-50 px-4 py-6">
        <div className="max-w-md mx-auto space-y-3">
          {profile.links && profile.links.length > 0 ? (
            profile.links.map((link) => (
              <button
                key={link.id}
                className="block w-full p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 text-left"
                onClick={() => handleLinkClick(link)}
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0" 
                    style={{ 
                      backgroundColor: `${backgroundColor}40`,
                      color: backgroundColor 
                    }}
                  >
                    <i className={`${link.iconType} text-lg`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{link.title}</h3>
                    {link.description && (
                      <p className="text-xs text-gray-500 truncate">{link.description}</p>
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-10 px-4">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <ExternalLink className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No links yet</h3>
                <p className="text-gray-500 text-sm mb-4">
                  {username} hasn't added any links to their profile yet.
                </p>
              </div>
            </div>
          )}
          
          {/* Share & QR Code */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-gray-500 text-xs"
                onClick={handleCopyProfileUrl}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy Profile URL
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-gray-500 text-xs"
                onClick={() => setIsQrDialogOpen(true)}
              >
                <i className="fas fa-qrcode mr-1 h-3 w-3"></i>
                QR Code
              </Button>
            </div>
            
            {/* Powered by footer */}
            <div className="text-center mt-8">
              <a 
                href="/"
                className="text-xs text-gray-400 hover:text-primary transition-colors"
              >
                Powered by LinkyBecky
              </a>
            </div>
          </div>
        </div>
      </div>
      
      {/* QR Code Dialog */}
      <QrCode 
        open={isQrDialogOpen} 
        onOpenChange={setIsQrDialogOpen}
        username={username}
      />
    </div>
  );
}
