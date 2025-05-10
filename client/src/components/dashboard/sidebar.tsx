import { useTabStore } from "@/lib/store";
import { Link, useLocation } from "wouter";
import {
  Link as LinkIcon,
  Palette,
  BarChart2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { currentTab, setTab } = useTabStore();
  const [location, setLocation] = useLocation();

  const handleTabChange = (tab: "links" | "appearance" | "analytics" | "settings") => {
    setTab(tab);
    setLocation(`/dashboard?tab=${tab}`, { replace: true });
  };

  return (
    <div className="hidden lg:block w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-[calc(100vh-4rem)] sticky top-16">
      <nav className="p-4 space-y-1">
        <button
          onClick={() => handleTabChange("links")}
          className={cn(
            "w-full flex items-center px-4 py-3 text-sm font-medium rounded-md",
            currentTab === "links"
              ? "bg-primary text-primary-foreground"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          <LinkIcon className="mr-3 h-5 w-5" />
          <span>Links</span>
        </button>
        
        <button
          onClick={() => handleTabChange("appearance")}
          className={cn(
            "w-full flex items-center px-4 py-3 text-sm font-medium rounded-md",
            currentTab === "appearance"
              ? "bg-primary text-primary-foreground"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          <Palette className="mr-3 h-5 w-5" />
          <span>Appearance</span>
        </button>
        
        <button
          onClick={() => handleTabChange("analytics")}
          className={cn(
            "w-full flex items-center px-4 py-3 text-sm font-medium rounded-md",
            currentTab === "analytics"
              ? "bg-primary text-primary-foreground"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          <BarChart2 className="mr-3 h-5 w-5" />
          <span>Analytics</span>
        </button>
        
        <button
          onClick={() => handleTabChange("settings")}
          className={cn(
            "w-full flex items-center px-4 py-3 text-sm font-medium rounded-md",
            currentTab === "settings"
              ? "bg-primary text-primary-foreground"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          <Settings className="mr-3 h-5 w-5" />
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}
