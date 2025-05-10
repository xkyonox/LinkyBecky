import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsStore } from "@/lib/store";

interface DemographicsProps {
  type: "countries" | "devices";
}

export function Demographics({ type }: DemographicsProps) {
  const { analytics } = useAnalyticsStore();

  const getData = () => {
    if (!analytics) return [];
    
    return type === "countries" 
      ? analytics.topCountries || []
      : analytics.devices || [];
  };

  const getTitle = () => {
    return type === "countries" ? "Top Countries" : "Devices";
  };

  if (!analytics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-32" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-10" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = getData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{getTitle()}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-4">
            {data.map((item, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm text-gray-700">{item.name}</div>
                  <div className="text-sm font-medium text-gray-900">{item.percentage}%</div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No {type} data available yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
