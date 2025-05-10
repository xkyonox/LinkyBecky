import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useLinkStore } from "@/lib/store";
import { type Link } from "@/types";

export function TopLinks() {
  const { links, setLinks } = useLinkStore();
  const [topLinks, setTopLinks] = useState<Link[]>([]);

  // Fetch links if not already loaded
  const { data, isLoading } = useQuery({
    queryKey: ['/api/links'],
    enabled: links.length === 0
  });

  useEffect(() => {
    if (data && links.length === 0) {
      setLinks(data);
    }
  }, [data, links.length, setLinks]);

  useEffect(() => {
    if (links.length > 0) {
      // Sort by clicks (descending) and take top 3
      const sorted = [...links]
        .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
        .slice(0, 3);
      
      setTopLinks(sorted);
    }
  }, [links]);

  if (isLoading || links.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-48" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="ml-3 flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Performing Links</CardTitle>
      </CardHeader>
      <CardContent>
        {topLinks.length > 0 ? (
          <div className="space-y-4">
            {topLinks.map((link) => (
              <div key={link.id} className="flex items-center">
                <div 
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(124, 58, 237, 0.25)" }}
                >
                  <i className={`${link.iconType} text-primary text-sm`}></i>
                </div>
                <div className="ml-3 flex-1">
                  <div className="text-sm font-medium text-gray-900">{link.title}</div>
                  <div className="text-xs text-gray-500">{link.shortUrl || link.url}</div>
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {`${link.clicks || 0} clicks`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No link data available yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
