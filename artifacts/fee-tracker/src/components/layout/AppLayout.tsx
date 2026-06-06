import { useState } from "react";
import { Menu, Bell } from "lucide-react";
import Sidebar from "./Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function AppLayout({ children, title }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { session } = useAuth();
  const { stats } = useData();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:ml-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 flex-shrink-0 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-open-sidebar"
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div className="flex-1 min-w-0">
            {title && (
              <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
            )}
          </div>

          {stats && stats.totalPending > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              <Bell className="w-3.5 h-3.5" />
              <span>₹{stats.totalPending.toLocaleString("en-IN")} pending</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground text-xs font-bold">
                {session?.username?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
            <span className="hidden sm:block text-sm font-medium text-foreground">{session?.username}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
