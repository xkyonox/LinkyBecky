import { useState } from "react";
import { Link } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useLinkStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Copy, Edit, Trash2, MoreVertical, GripVertical, QrCode } from "lucide-react";
import { copyToClipboard } from "@/lib/utils";
import { LinkDialog } from "./link-form";

interface LinkItemProps {
  link: Link;
  isDragging?: boolean;
  dragHandleProps?: any;
}

export function LinkItem({ link, isDragging, dragHandleProps }: LinkItemProps) {
  const { removeLink, updateLink } = useLinkStore();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCopyShortUrl = async () => {
    if (link.shortUrl) {
      const success = await copyToClipboard(link.shortUrl);
      if (success) {
        toast({
          title: "URL copied",
          description: "The short URL has been copied to your clipboard."
        });
      } else {
        toast({
          title: "Copy failed",
          description: "Failed to copy the URL. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  const handleToggleEnabled = async () => {
    try {
      const updatedLink = { ...link, enabled: !link.enabled };
      await apiRequest('PUT', `/api/links/${link.id}`, { enabled: !link.enabled });
      updateLink(link.id, { enabled: !link.enabled });
      toast({
        title: `Link ${!link.enabled ? "enabled" : "disabled"}`,
        description: `"${link.title}" has been ${!link.enabled ? "enabled" : "disabled"}.`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update link status",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    try {
      setIsLoading(true);
      await apiRequest('DELETE', `/api/links/${link.id}`, undefined);
      removeLink(link.id);
      queryClient.invalidateQueries({ queryKey: ['/api/links'] });
      toast({
        title: "Link deleted",
        description: `"${link.title}" has been deleted.`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete link",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetQrCode = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest('GET', `/api/links/${link.id}/qrcode`, undefined);
      const data = await response.json();
      setQrCodeUrl(data.qrCodeUrl);
      setIsQrDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card 
        className={`border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden ${!link.enabled ? 'opacity-70' : ''} ${isDragging ? 'opacity-50 scale-98' : ''}`}
      >
        <div className="px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Drag handle */}
              <div 
                className="cursor-move text-gray-400"
                {...dragHandleProps}
              >
                <GripVertical size={18} />
              </div>
              
              {/* Icon */}
              <div 
                className="h-10 w-10 rounded-full flex items-center justify-center" 
                style={{ backgroundColor: 'rgba(124, 58, 237, 0.25)' }}
              >
                <i className={`${link.iconType} text-lg text-primary`}></i>
              </div>
              
              {/* Link info */}
              <div>
                <h3 className="text-sm font-medium text-gray-900">{link.title}</h3>
                <div className="flex items-center">
                  <p className="text-xs text-gray-500">
                    {link.shortUrl || link.url}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-1 p-0 h-4 w-4"
                    onClick={handleCopyShortUrl}
                  >
                    <Copy size={12} className="text-primary" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-4">
              {/* Stats badge */}
              <div className="hidden sm:flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded-full">
                <i className="fas fa-chart-line text-xs text-gray-500"></i>
                <span className="text-xs font-medium text-gray-600">{link.clicks || 0}</span>
              </div>
              
              {/* Enable/disable toggle */}
              <Switch 
                checked={link.enabled}
                onCheckedChange={handleToggleEnabled}
                aria-label="Toggle link visibility"
              />
              
              {/* Edit/Delete dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-1 h-8 w-8">
                    <MoreVertical size={16} className="text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                    <Edit size={14} className="mr-2" />
                    Edit Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleGetQrCode}>
                    <QrCode size={14} className="mr-2" />
                    Get QR Code
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleDelete}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 size={14} className="mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </Card>

      {/* Edit Dialog */}
      <LinkDialog 
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        link={link}
        mode="edit"
      />

      {/* QR Code Dialog */}
      {qrCodeUrl && (
        <QrCodeDialog 
          open={isQrDialogOpen}
          onOpenChange={setIsQrDialogOpen}
          qrCodeUrl={qrCodeUrl}
          link={link}
        />
      )}
    </>
  );
}

interface QrCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCodeUrl: string;
  link: Link;
}

function QrCodeDialog({ open, onOpenChange, qrCodeUrl, link }: QrCodeDialogProps) {
  const { toast } = useToast();
  
  const handleDownload = async () => {
    try {
      const a = document.createElement('a');
      a.href = qrCodeUrl;
      a.download = `${link.title.replace(/\s+/g, '-').toLowerCase()}-qr-code.png`;
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
          <DialogTitle>QR Code for {link.title}</DialogTitle>
          <DialogDescription>
            Share your link by scanning this QR code.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-4">
          <div className="border border-gray-200 rounded-lg p-2 bg-white">
            <img 
              src={qrCodeUrl} 
              alt={`QR Code for ${link.title}`} 
              className="w-64 h-64 object-contain"
            />
          </div>
          <div className="text-sm text-gray-500 mt-2 text-center">
            <p>{link.shortUrl || link.url}</p>
          </div>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button variant="outline" onClick={handleDownload} className="mt-2 w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Download QR Code
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Import these at the top of the file
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download } from "lucide-react";
