import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function Integrations() {
  const { toast } = useToast();
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isZapierConnected, setIsZapierConnected] = useState(false);
  const [isWebhookEnabled, setIsWebhookEnabled] = useState(false);

  const handleConnectGoogle = () => {
    // This would typically redirect to a Google OAuth flow
    toast({
      title: "Coming Soon",
      description: "Google Analytics integration will be available soon.",
    });
  };

  const handleConnectZapier = () => {
    // This would typically redirect to Zapier to set up a connection
    toast({
      title: "Coming Soon",
      description: "Zapier integration will be available soon.",
    });
  };

  const handleToggleWebhook = (enabled: boolean) => {
    setIsWebhookEnabled(enabled);
    
    if (enabled) {
      toast({
        title: "Webhooks Enabled",
        description: "You will now receive webhook notifications for link clicks.",
      });
    } else {
      toast({
        title: "Webhooks Disabled",
        description: "You will no longer receive webhook notifications.",
      });
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Integrations</h2>
        <div className="space-y-4">
          {/* Google Analytics */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-10 w-10 flex-shrink-0">
                  <i className="fab fa-google text-2xl text-gray-600"></i>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-gray-900">Google Analytics</h3>
                  <p className="text-xs text-gray-500">Connect to track advanced metrics</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleConnectGoogle}
              >
                {isGoogleConnected ? "Disconnect" : "Connect"}
              </Button>
            </div>
          </div>
          
          {/* Zapier */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-10 w-10 flex-shrink-0">
                  <i className="fas fa-bolt text-2xl text-gray-600"></i>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-gray-900">Zapier</h3>
                  <p className="text-xs text-gray-500">Create workflows based on link clicks</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleConnectZapier}
              >
                {isZapierConnected ? "Disconnect" : "Connect"}
              </Button>
            </div>
          </div>
          
          {/* Webhooks */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Webhooks</h3>
                <p className="text-xs text-gray-500">Receive real-time notifications when links are clicked</p>
              </div>
              <Switch
                checked={isWebhookEnabled}
                onCheckedChange={handleToggleWebhook}
              />
            </div>
            
            {isWebhookEnabled && (
              <div>
                <Label htmlFor="webhook-url" className="text-xs font-medium text-gray-700">
                  Webhook URL
                </Label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="url"
                    id="webhook-url"
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
                    placeholder="https://your-server.com/webhook"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  We'll send a POST request to this URL when a link is clicked.
                </p>
              </div>
            )}
          </div>
          
          {/* Pro Plan Upgrade */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <div className="bg-gradient-to-r from-purple-600 to-blue-500 p-4 rounded-lg text-white cursor-pointer hover:from-purple-700 hover:to-blue-600 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Upgrade to Pro</h3>
                    <p className="text-xs opacity-90 mt-1">Get advanced integrations, unlimited links, and priority support</p>
                  </div>
                  <span className="text-sm font-bold bg-white text-blue-600 py-1 px-3 rounded-full">
                    $4.99/mo
                  </span>
                </div>
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Upgrade to Pro Plan</AlertDialogTitle>
                <AlertDialogDescription>
                  LinkyBecky Pro gives you access to:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Unlimited links</li>
                    <li>Advanced analytics</li>
                    <li>Priority support</li>
                    <li>Custom domains</li>
                    <li>Advanced integrations</li>
                    <li>No LinkyBecky branding</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Maybe Later</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                  toast({
                    title: "Coming Soon",
                    description: "Pro plan will be available soon!",
                  });
                }}>
                  Upgrade Now
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
