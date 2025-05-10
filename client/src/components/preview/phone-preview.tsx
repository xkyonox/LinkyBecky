import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProfileStore, useLinkStore, useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/utils";
import { QrCode } from "./qr-code";

export function PhonePreview() {
  const { user } = useAuthStore();
  const { profile, setProfile } = useProfileStore();
  const { links } = useLinkStore();
  const { toast } = useToast();
  const [profileUrl, setProfileUrl] = useState("");
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  
  // Fetch profile if not already loaded
  const { data: profileData } = useQuery({
    queryKey: ['/api/profile'],
    enabled: !profile
  });

  useEffect(() => {
    if (profileData && !profile) {
      setProfile(profileData);
    }
  }, [profileData, profile, setProfile]);

  useEffect(() => {
    if (user?.username) {
      setProfileUrl(`linkybecky.com/@${user.username}`);
    }
  }, [user]);

  const handleCopyUrl = async () => {
    if (profileUrl) {
      const success = await copyToClipboard(`https://${profileUrl}`);
      if (success) {
        toast({
          title: "URL copied",
          description: "Your profile URL has been copied to clipboard"
        });
      } else {
        toast({
          title: "Copy failed",
          description: "Failed to copy URL to clipboard",
          variant: "destructive"
        });
      }
    }
  };

  // Filter enabled links
  const enabledLinks = links.filter(link => link.enabled);

  // Sort links by position
  const sortedLinks = [...enabledLinks].sort((a, b) => a.position - b.position);

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Live Preview</h2>
      
      {/* Phone Mockup */}
      <div className="max-w-[375px] h-[667px] mx-auto border-8 border-black rounded-[36px] bg-black shadow-xl">
        <div className="h-full rounded-[30px] overflow-y-auto bg-white relative">
          {/* Profile Header */}
          <div 
            className="flex flex-col items-center pt-8 pb-4"
            style={{ 
              backgroundColor: profile?.backgroundColor || "#7c3aed",
              color: profile?.textColor || "#ffffff",
              fontFamily: profile?.fontFamily || "Inter"
            }}
          >
            <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-white">
              {user?.avatar ? (
                <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gray-100 text-gray-800 text-2xl font-bold">
                  {user?.name?.charAt(0) || user?.username?.charAt(0) || "?"}
                </div>
              )}
            </div>
            <h1 className="text-xl font-bold mt-4">{user?.name || "Your Name"}</h1>
            <p className="opacity-90 text-sm mt-1 text-center px-6">{user?.bio || "Your bio goes here"}</p>
            
            {/* Social Icons */}
            {profile?.socialLinks && profile.socialLinks.length > 0 && (
              <div className="flex space-x-3 mt-4">
                {profile.socialLinks.map((social, index) => (
                  <a 
                    key={index} 
                    href="#" 
                    className="h-8 w-8 rounded-full bg-white bg-opacity-20 flex items-center justify-center hover:bg-opacity-30"
                    onClick={(e) => e.preventDefault()}
                  >
                    <i className={`fab fa-${social.platform} text-white`}></i>
                  </a>
                ))}
              </div>
            )}
          </div>
          
          {/* Links Preview */}
          <div className="px-4 py-6 space-y-3">
            {sortedLinks.length > 0 ? (
              sortedLinks.map((link) => (
                <a 
                  key={link.id}
                  href="#" 
                  className="block w-full p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 flex items-center space-x-3"
                  onClick={(e) => e.preventDefault()}
                >
                  <div 
                    className="h-10 w-10 rounded-full flex items-center justify-center" 
                    style={{ 
                      backgroundColor: `${profile?.backgroundColor || "#7c3aed"}40`,
                      color: profile?.backgroundColor || "#7c3aed" 
                    }}
                  >
                    <i className={`${link.iconType} text-lg`}></i>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{link.title}</h3>
                    {link.description && (
                      <p className="text-xs text-gray-500">{link.description}</p>
                    )}
                  </div>
                </a>
              ))
            ) : (
              <div className="text-center py-8 px-4">
                <p className="text-gray-500">No links to display yet. Add some links to see them here.</p>
              </div>
            )}
          </div>
          
          {/* Powered by */}
          <div className="pb-6 px-4 text-center">
            <p className="text-xs text-gray-400">Powered by LinkyBecky</p>
          </div>
        </div>
      </div>
      
      {/* Share section */}
      <div className="mt-6 border-t border-gray-200 pt-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Share your page</h3>
        <div className="flex items-center">
          <div className="flex-grow flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-l-md">
            <i className="fas fa-link text-gray-400"></i>
            <input 
              type="text" 
              value={profileUrl} 
              readOnly 
              className="block w-full bg-transparent border-0 text-sm text-gray-900 focus:ring-0"
            />
          </div>
          <Button
            onClick={handleCopyUrl}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            <Copy size={16} />
          </Button>
        </div>
        
        <div className="mt-4 flex justify-between">
          <Button 
            variant="outline"
            onClick={() => setIsQrDialogOpen(true)}
            className="text-sm"
          >
            View QR Code
          </Button>
          
          <Button 
            variant="outline"
            className="text-sm"
            asChild
          >
            <a 
              href={`/@${user?.username}`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} className="mr-2" />
              Open Live Page
            </a>
          </Button>
        </div>
      </div>
      
      {/* QR Code Dialog */}
      <QrCode 
        open={isQrDialogOpen} 
        onOpenChange={setIsQrDialogOpen}
        username={user?.username || ""}
      />
    </div>
  );
}
