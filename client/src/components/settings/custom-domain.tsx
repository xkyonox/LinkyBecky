import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfileStore } from "@/lib/store";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function CustomDomain() {
  const { profile, updateProfile } = useProfileStore();
  const { toast } = useToast();
  const [domain, setDomain] = useState(profile?.customDomain || "");
  
  // Update custom domain mutation
  const updateDomainMutation = useMutation({
    mutationFn: async (customDomain: string) => {
      await apiRequest('PUT', '/api/profile', { customDomain });
    },
    onSuccess: () => {
      toast({
        title: "Domain connected",
        description: "Your custom domain has been connected successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      updateProfile({ customDomain: domain });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to connect custom domain. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleConnectDomain = () => {
    if (!domain) {
      toast({
        title: "Domain required",
        description: "Please enter a domain to connect.",
        variant: "destructive",
      });
      return;
    }
    
    // Simple domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(domain)) {
      toast({
        title: "Invalid domain",
        description: "Please enter a valid domain (e.g., yourdomain.com).",
        variant: "destructive",
      });
      return;
    }
    
    updateDomainMutation.mutate(domain);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Custom Domain</h2>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="mb-4">
            <Label htmlFor="custom-domain">Your Domain</Label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <Input 
                type="text" 
                id="custom-domain" 
                name="custom-domain" 
                placeholder="yourdomain.com" 
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Connect your own domain to your LinkyBecky profile.
            </p>
          </div>
          
          {profile?.customDomain && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                Your profile is currently available at <strong>{profile.customDomain}</strong>
              </p>
            </div>
          )}
          
          <Button 
            onClick={handleConnectDomain}
            disabled={updateDomainMutation.isPending}
          >
            {updateDomainMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {profile?.customDomain ? "Update Domain" : "Connect Domain"}
          </Button>
        </div>
        
        {!profile?.customDomain && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">How to connect your domain</h3>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2">
              <li>Register a domain with your preferred domain registrar (e.g., GoDaddy, Namecheap).</li>
              <li>Set up a CNAME record pointing to <code>custom.linkybecky.com</code>.</li>
              <li>Enter your domain above and click "Connect Domain".</li>
              <li>Wait for DNS propagation (may take up to 48 hours).</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
