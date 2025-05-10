import { StatsCards } from "@/components/dashboard/stats-cards";
import { StatsChart } from "./stats-chart";
import { TopLinks } from "./top-links";
import { Demographics } from "./demographics";

export function AnalyticsOverview() {
  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <StatsCards />
      
      {/* Weekly Chart */}
      <div className="grid grid-cols-1 gap-8">
        <StatsChart />
      </div>
      
      {/* Top Performing Links */}
      <TopLinks />
      
      {/* Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Demographics type="countries" />
        <Demographics type="devices" />
      </div>
    </div>
  );
}
