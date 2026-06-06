import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, CreditCard, FileText, BarChart2, Settings, GraduationCap, LogOut, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/students", label: "Students", icon: Users },
  { path: "/payments", label: "Payments", icon: CreditCard },
  { path: "/receipts", label: "Receipts", icon: FileText },
  { path: "/reports", label: "Reports", icon: BarChart2 },
  { path: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { session, logout } = useAuth();
  const { profile } = useData();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 z-40 flex flex-col",
          "bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
          "transition-transform duration-200 ease-in-out",
          "lg:translate-x-0 lg:static lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-sidebar-primary-foreground truncate leading-tight">
                {profile?.name || "Fee Tracker"}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{session?.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground p-1 rounded"
            data-testid="button-close-sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location === path || (path !== "/dashboard" && location.startsWith(path));
            return (
              <Link
                key={path}
                href={path}
                onClick={onClose}
                data-testid={`link-nav-${label.toLowerCase()}`}
              >
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 text-sm"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  );
}
