import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download } from "lucide-react";

interface QrCodeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
}

export function QrCode({ open, onOpenChange, username }: QrCodeProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    if (open && username) {
      setIsLoading(true);
      // Use the Google Charts API to generate a QR code
      const url = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=https://linkybecky.com/@${username}&choe=UTF-8`;
      setQrCodeUrl(url);
      setIsLoading(false);
    }
  }, [open, username]);
  
  const handleDownload = async () => {
    if (!qrCodeUrl) return;
    
    try {
      // Fetch the image
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      
      // Create a download link
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `linkybecky-qr-${username}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: "QR Code downloaded",
        description: "The QR code has been saved to your device"
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download the QR code. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code for your profile</DialogTitle>
          <DialogDescription>
            Share your profile by scanning this QR code
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-4">
          {isLoading ? (
            <div className="h-64 w-64 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : qrCodeUrl ? (
            <div className="border border-gray-200 rounded-lg p-2 bg-white">
              <img 
                src={qrCodeUrl} 
                alt={`QR Code for @${username}`} 
                className="w-64 h-64 object-contain"
              />
            </div>
          ) : (
            <div className="h-64 w-64 flex items-center justify-center border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-500">Failed to generate QR code</p>
            </div>
          )}
          
          <div className="text-sm text-gray-500 mt-2 text-center">
            <p>linkybecky.com/@{username}</p>
          </div>
        </div>
        
        <DialogFooter className="sm:justify-center">
          <Button 
            variant="outline" 
            onClick={handleDownload} 
            className="mt-2 w-full sm:w-auto"
            disabled={isLoading || !qrCodeUrl}
          >
            <Download className="mr-2 h-4 w-4" />
            Download QR Code
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
