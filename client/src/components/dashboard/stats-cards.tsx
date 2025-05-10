import { Eye, MousePointer, TrendingUp, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAnalyticsStore } from "@/lib/store";
import { formatNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsCards() {
  const { analytics, setAnalytics } = useAnalyticsStore();

  // Fetch analytics data
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["/api/analytics"],
  });

  useEffect(() => {
    if (analyticsData) {
      // Process and combine the analytics data
      const totalClicks = analyticsData.reduce((sum: number, item: any) => sum + item.clicks, 0);
      
      // Get today's clicks
      const today = new Date().toISOString().split('T')[0];
      const todayClicks = analyticsData
        .filter((item: any) => new Date(item.date).toISOString().split('T')[0] === today)
        .reduce((sum: number, item: any) => sum + item.clicks, 0);
      
      // Calculate growth (comparing today with yesterday)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const yesterdayClicks = analyticsData
        .filter((item: any) => new Date(item.date).toISOString().split('T')[0] === yesterdayStr)
        .reduce((sum: number, item: any) => sum + item.clicks, 0);
      
      const growth = yesterdayClicks > 0 
        ? Math.round((todayClicks - yesterdayClicks) / yesterdayClicks * 100) 
        : 100;
      
      // Process top countries
      const countriesMap: { [key: string]: number } = {};
      analyticsData.forEach((item: any) => {
        if (item.country) {
          countriesMap[item.country] = (countriesMap[item.country] || 0) + item.clicks;
        }
      });
      
      const topCountries = Object.entries(countriesMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name, clicks]) => ({
          name,
          percentage: Math.round((clicks / totalClicks) * 100) || 0,
        }));
      
      // Process devices
      const devicesMap: { [key: string]: number } = {};
      analyticsData.forEach((item: any) => {
        if (item.device) {
          devicesMap[item.device] = (devicesMap[item.device] || 0) + item.clicks;
        }
      });
      
      const devices = Object.entries(devicesMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, clicks]) => ({
          name,
          percentage: Math.round((clicks / totalClicks) * 100) || 0,
        }));
      
      // Get last 7 days data
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split('T')[0];
      });
      
      const weeklyData = last7Days.map(day => {
        return analyticsData
          .filter((item: any) => new Date(item.date).toISOString().split('T')[0] === day)
          .reduce((sum: number, item: any) => sum + item.clicks, 0);
      });
      
      setAnalytics({
        totalClicks,
        today: todayClicks,
        growth,
        topCountries,
        devices,
        weeklyData,
      });
    }
  }, [analyticsData, setAnalytics]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[...Array(4)].map((_, index) => (
          <Card key={index} className="p-5">
            <div className="flex items-center">
              <Skeleton className="h-12 w-12 rounded-md" />
              <div className="ml-5 w-0 flex-1">
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {/* Card 1: Total Views */}
      <Card>
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-primary-100 dark:bg-primary-900 rounded-md p-3">
              <Eye className="text-primary w-5 h-5" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Views</dt>
                <dd>
                  <div className="text-lg font-medium text-gray-900 dark:text-white">
                    {formatNumber(14582)}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </Card>
      
      {/* Card 2: Total Clicks */}
      <Card>
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 dark:bg-green-900 rounded-md p-3">
              <MousePointer className="text-green-600 dark:text-green-400 w-5 h-5" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Clicks</dt>
                <dd>
                  <div className="text-lg font-medium text-gray-900 dark:text-white">
                    {formatNumber(analytics?.totalClicks || 0)}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </Card>
      
      {/* Card 3: Click Rate */}
      <Card>
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900 rounded-md p-3">
              <TrendingUp className="text-blue-600 dark:text-blue-400 w-5 h-5" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Click Rate</dt>
                <dd>
                  <div className="text-lg font-medium text-gray-900 dark:text-white">
                    {analytics?.totalClicks && 14582 ? `${((analytics.totalClicks / 14582) * 100).toFixed(1)}%` : "0.0%"}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </Card>
      
      {/* Card 4: Today */}
      <Card>
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-100 dark:bg-yellow-900 rounded-md p-3">
              <Clock className="text-yellow-600 dark:text-yellow-400 w-5 h-5" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Today</dt>
                <dd>
                  <div className="text-lg font-medium text-gray-900 dark:text-white">
                    {formatNumber(analytics?.today || 0)}
                  </div>
                  <div className={`text-sm ${analytics?.growth && analytics.growth > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    <span className="flex items-center">
                      {analytics?.growth && analytics.growth > 0 ? '↑' : '↓'} {Math.abs(analytics?.growth || 0)}%
                    </span>
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
