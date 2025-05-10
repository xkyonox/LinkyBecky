import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLinkStore } from "@/lib/store";
import { Download, Loader2 } from "lucide-react";

export function ExportData() {
  const { links } = useLinkStore();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const exportToCsv = () => {
    setIsExporting(true);
    
    try {
      // Convert links to CSV format
      const headers = [
        "id",
        "title",
        "url",
        "shortUrl",
        "description",
        "iconType",
        "position",
        "enabled",
        "clicks",
        "createdAt",
        "updatedAt",
      ];
      
      let csvContent = headers.join(",") + "\n";
      
      links.forEach(link => {
        const row = [
          link.id,
          `"${(link.title || "").replace(/"/g, '""')}"`,
          `"${(link.url || "").replace(/"/g, '""')}"`,
          `"${(link.shortUrl || "").replace(/"/g, '""')}"`,
          `"${(link.description || "").replace(/"/g, '""')}"`,
          `"${(link.iconType || "").replace(/"/g, '""')}"`,
          link.position,
          link.enabled ? "true" : "false",
          link.clicks || 0,
          link.createdAt,
          link.updatedAt,
        ];
        
        csvContent += row.join(",") + "\n";
      });
      
      // Create a blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      link.setAttribute("href", url);
      link.setAttribute("download", `linkybecky-export-${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export successful",
        description: "Your data has been exported as a CSV file.",
      });
    } catch (error) {
      console.error("Export error:", error);
      
      toast({
        title: "Export failed",
        description: "There was an error exporting your data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Export Data</h2>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-700 mb-4">
            Download your link data and analytics in CSV format.
          </p>
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={exportToCsv}
              disabled={isExporting || links.length === 0}
              className="w-full sm:w-auto"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export Link Data
            </Button>
            
            <div className="text-xs text-gray-500 pt-2">
              <p>Data will include:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Link URLs and titles</li>
                <li>Shortened URLs</li>
                <li>Click counts</li>
                <li>Creation and update dates</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
