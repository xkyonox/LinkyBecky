import { ReactNode } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { useTabStore } from "@/lib/store";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { currentTab } = useTabStore();
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="flex-1 flex flex-col lg:flex-row pt-14">
        <Sidebar />
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              {currentTab === "links" && "Manage Links"}
              {currentTab === "appearance" && "Appearance"}
              {currentTab === "analytics" && "Analytics"}
              {currentTab === "settings" && "Settings"}
            </h1>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
