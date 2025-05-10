import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiInsightStore } from "@/lib/store";
import { apiRequest } from "@/lib/queryClient";
import { formatRelativeTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Bot, X } from "lucide-react";

export function AiInsights() {
  const { insights, setInsights, markInsightAsSeen } = useAiInsightStore();
  const { toast } = useToast();
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);

  // Fetch AI insights from the API
  const { data, isLoading } = useQuery({
    queryKey: ['/api/ai/insights'],
  });

  // Update local store when data is fetched
  useEffect(() => {
    if (data) {
      setInsights(data);
    }
  }, [data, setInsights]);

  const handleDismissInsight = async (id: number) => {
    try {
      await apiRequest('POST', `/api/ai/insights/${id}/seen`, {});
      markInsightAsSeen(id);
      
      // Move to the next unread insight if available
      const nextUnreadIndex = insights.findIndex((insight, index) => 
        index > currentInsightIndex && !insight.seen
      );
      
      if (nextUnreadIndex !== -1) {
        setCurrentInsightIndex(nextUnreadIndex);
      } else {
        // Go back to the first unread insight
        const firstUnreadIndex = insights.findIndex(insight => !insight.seen);
        setCurrentInsightIndex(firstUnreadIndex !== -1 ? firstUnreadIndex : 0);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to dismiss insight",
        variant: "destructive"
      });
    }
  };

  // Return null if there are no unread insights
  if (!isLoading && (!insights || insights.length === 0 || !insights.some(insight => !insight.seen))) {
    return null;
  }

  // Show a loading skeleton
  if (isLoading) {
    return (
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start space-x-4">
            <Skeleton className="h-10 w-10 rounded-full bg-blue-200" />
            <div className="flex-1">
              <Skeleton className="h-5 w-40 mb-2 bg-blue-200" />
              <Skeleton className="h-4 w-full bg-blue-200" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Find the current insight to display
  const unreadInsights = insights.filter(insight => !insight.seen);
  const currentInsight = unreadInsights[currentInsightIndex] || insights[0];

  if (!currentInsight) {
    return null;
  }

  // Determine the icon and color based on the insight type
  let iconColor = "text-blue-600";
  
  if (currentInsight.type === "performance") {
    iconColor = "text-green-600";
  } else if (currentInsight.type === "recommendation") {
    iconColor = "text-purple-600";
  }

  return (
    <Card className="mb-6 p-4 border border-blue-200 rounded-lg bg-blue-50">
      <CardContent className="p-0">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 p-1 rounded-full bg-blue-100">
            <Bot className={`${iconColor} h-6 w-6`} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-blue-800">AI Assistant Insight</h3>
                <p className="text-xs text-blue-600">
                  {formatRelativeTime(currentInsight.createdAt)}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                onClick={() => handleDismissInsight(currentInsight.id)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Dismiss</span>
              </Button>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              {currentInsight.content}
            </p>
            
            {/* Counter for multiple insights */}
            {unreadInsights.length > 1 && (
              <div className="mt-2 text-xs text-blue-600">
                {currentInsightIndex + 1} of {unreadInsights.length} insights
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
