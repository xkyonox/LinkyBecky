import { useEffect } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LinkList } from "@/components/links/link-list";
import { ProfileForm } from "@/components/profile/profile-form";
import { ThemeSelector } from "@/components/profile/theme-selector";
import { SocialLinks } from "@/components/profile/social-links";
import { AnalyticsOverview } from "@/components/analytics/analytics-overview";
import { CustomDomain } from "@/components/settings/custom-domain";
import { Integrations } from "@/components/settings/integrations";
import { ExportData } from "@/components/settings/export-data";
import { PhonePreview } from "@/components/preview/phone-preview";
import { useTabStore } from "@/lib/store";
import { useQueryParams } from "@/hooks/use-query-params";

export default function Dashboard() {
  const { currentTab, setTab } = useTabStore();
  const [location] = useLocation();
  const { getQueryParams } = useQueryParams();
  
  // Set the current tab based on the URL query parameter
  useEffect(() => {
    const params = getQueryParams();
    if (params.tab) {
      const tab = params.tab as "links" | "appearance" | "analytics" | "settings";
      setTab(tab);
    }
  }, [location, getQueryParams, setTab]);

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row space-y-8 lg:space-y-0 lg:space-x-8">
        {/* Main content */}
        <div className="w-full lg:w-7/12 space-y-6">
          {currentTab === "links" && <LinkList />}
          
          {currentTab === "appearance" && (
            <>
              <ProfileForm />
              <ThemeSelector />
              <SocialLinks />
            </>
          )}
          
          {currentTab === "analytics" && <AnalyticsOverview />}
          
          {currentTab === "settings" && (
            <>
              <CustomDomain />
              <Integrations />
              <ExportData />
            </>
          )}
        </div>
        
        {/* Preview */}
        <div className="w-full lg:w-5/12">
          <PhonePreview />
        </div>
      </div>
    </DashboardLayout>
  );
}
