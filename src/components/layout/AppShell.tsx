import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { useIsMobile } from "@/hooks/use-mobile";
import AppSidebar from "./AppSidebar";
import MobileBottomTabs from "./MobileBottomTabs";
import TopBar from "./TopBar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  user: User;
  role: string;
  pageTitle?: string;
}

// Map routes to page titles
const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/daily-summary": "Daily Summary",
  "/weekly-summary": "Weekly Summary",
  "/roster/weekly": "Weekly Roster",
  "/roster/daily": "Daily Roster",
  "/packet-dispatch": "Packet Dispatch",
  "/packet-dispatch/history": "Dispatch History",
  "/daily-report": "Daily Club Report",
  "/inspections/new": "New Inspection",
  "/inspections": "Inspection History",
  "/staff-performance": "Staff Performance",
  "/manage-employees": "Manage Employees",
  "/attendance-report": "Attendance Report",
  "/accessories": "Accessory Tracker",
  "/counter-pictures": "Counter Pictures",
  "/manage-venues": "Manage Venues",
  "/manage-flavours": "Manage Flavours",
  "/manage-categories": "Hookah Categories",
  "/my-profile": "My Profile",
};

const AppShell = ({ children, user, role, pageTitle }: AppShellProps) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const resolvedTitle = pageTitle || routeTitles[location.pathname] || "Smokzy";

  // Check if we should use tablet collapsed mode (768-1023)
  const isTablet = typeof window !== "undefined" && window.innerWidth >= 768 && window.innerWidth < 1024;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r bg-card h-screen sticky top-0 transition-all duration-200 shrink-0",
          sidebarCollapsed || isTablet ? "w-16" : "w-60"
        )}
      >
        <div className="h-14 border-b flex items-center justify-center px-3">
          {!sidebarCollapsed && !isTablet && (
            <span className="text-sm font-bold text-primary tracking-tight">SMOKZY</span>
          )}
          {(sidebarCollapsed || isTablet) && (
            <span className="text-lg font-bold text-primary">S</span>
          )}
        </div>
        <AppSidebar collapsed={sidebarCollapsed || isTablet} role={role} />
      </aside>

      {/* Mobile "More" drawer */}
      <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <div className="h-14 border-b flex items-center px-4">
            <span className="text-sm font-bold text-primary">SMOKZY</span>
          </div>
          <AppSidebar onNavigate={() => setMobileDrawerOpen(false)} role={role} />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          user={user}
          pageTitle={resolvedTitle}
          onMobileMenuClick={() => setMobileDrawerOpen(true)}
          showSidebarToggle
        />

        <main className={cn(
          "flex-1 p-4 md:p-6",
          isMobile && "pb-20" // space for bottom tab bar
        )}>
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <MobileBottomTabs onMoreClick={() => setMobileDrawerOpen(true)} />
      )}
    </div>
  );
};

export default AppShell;
