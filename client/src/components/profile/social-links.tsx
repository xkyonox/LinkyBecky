import { useState, useEffect } from "react";
import { useProfileStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { SocialLink } from "@/types";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";

// Available social platform options
const socialPlatforms = [
  { name: "Twitter", value: "twitter" },
  { name: "Instagram", value: "instagram" },
  { name: "Facebook", value: "facebook" },
  { name: "LinkedIn", value: "linkedin" },
  { name: "GitHub", value: "github" },
  { name: "YouTube", value: "youtube" },
  { name: "TikTok", value: "tiktok" },
  { name: "Pinterest", value: "pinterest" },
  { name: "Snapchat", value: "snapchat" },
  { name: "Dribbble", value: "dribbble" },
  { name: "Behance", value: "behance" },
  { name: "Medium", value: "medium" },
  { name: "Twitch", value: "twitch" },
  { name: "Discord", value: "discord" },
  { name: "Spotify", value: "spotify" },
];

export function SocialLinks() {
  const { profile, setProfile, addSocialLink, updateSocialLink, removeSocialLink } = useProfileStore();
  const { toast } = useToast();
  const [newPlatform, setNewPlatform] = useState("twitter");
  const [newUrl, setNewUrl] = useState("");

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (socialLinks: SocialLink[]) => {
      await apiRequest('PUT', '/api/profile', { socialLinks });
    },
    onSuccess: () => {
      toast({
        title: "Social links updated",
        description: "Your social links have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update social links. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddSocialLink = () => {
    if (!newUrl) {
      toast({
        title: "URL required",
        description: "Please enter a URL for the social link.",
        variant: "destructive",
      });
      return;
    }

    // Add http:// prefix if missing
    let processedUrl = newUrl;
    if (!/^https?:\/\//i.test(processedUrl)) {
      processedUrl = `https://${processedUrl}`;
    }

    // Add to local state
    addSocialLink(newPlatform, processedUrl);
    
    // Update on the server
    const updatedSocialLinks = [...(profile?.socialLinks || []), { platform: newPlatform, url: processedUrl }];
    updateProfileMutation.mutate(updatedSocialLinks);
    
    // Reset form
    setNewPlatform("twitter");
    setNewUrl("");
  };

  const handleUpdateSocialLink = (index: number, platform: string, url: string) => {
    // Update local state
    updateSocialLink(index, platform, url);
    
    // Update on the server
    const updatedSocialLinks = [...(profile?.socialLinks || [])];
    updatedSocialLinks[index] = { platform, url };
    updateProfileMutation.mutate(updatedSocialLinks);
  };

  const handleRemoveSocialLink = (index: number) => {
    // Update local state
    removeSocialLink(index);
    
    // Update on the server
    const updatedSocialLinks = [...(profile?.socialLinks || [])];
    updatedSocialLinks.splice(index, 1);
    updateProfileMutation.mutate(updatedSocialLinks);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-medium mb-4">Social Links</h3>
        
        <div className="space-y-4">
          {profile?.socialLinks && profile.socialLinks.length > 0 ? (
            profile.socialLinks.map((social, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <i className={`fab fa-${social.platform} text-gray-600`}></i>
                </div>
                <Select
                  value={social.platform}
                  onValueChange={(value) => handleUpdateSocialLink(index, value, social.url)}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {socialPlatforms.map((platform) => (
                      <SelectItem key={platform.value} value={platform.value}>
                        {platform.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input 
                  value={social.url} 
                  onChange={(e) => handleUpdateSocialLink(index, social.platform, e.target.value)} 
                  className="flex-1"
                />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleRemoveSocialLink(index)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">No social links added yet</p>
            </div>
          )}
          
          <div className="flex items-center space-x-4 border-t pt-4 mt-4">
            <Select
              value={newPlatform}
              onValueChange={setNewPlatform}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                {socialPlatforms.map((platform) => (
                  <SelectItem key={platform.value} value={platform.value}>
                    {platform.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input 
              value={newUrl} 
              onChange={(e) => setNewUrl(e.target.value)} 
              placeholder="https://twitter.com/username"
              className="flex-1"
            />
            <Button 
              onClick={handleAddSocialLink}
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus size={16} />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
