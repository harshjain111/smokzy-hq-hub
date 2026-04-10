import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarCheck,
  Package,
  ClipboardCheck,
  Menu,
} from "lucide-react";

interface MobileBottomTabsProps {
  onMoreClick: () => void;
}

const tabs = [
  { label: "Home", icon: LayoutDashboard, route: "/dashboard" },
  { label: "Roster", icon: CalendarCheck, route: "/roster/daily" },
  { label: "Dispatch", icon: Package, route: "/packet-dispatch" },
  { label: "Inspect", icon: ClipboardCheck, route: "/inspections/new" },
];

const MobileBottomTabs = ({ onMoreClick }: MobileBottomTabsProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-[0_-2px_10px_rgba(0,0,0,0.06)] safe-bottom md:hidden">
      <div className="flex items-stretch h-14">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.route || 
            (tab.route === "/dashboard" && (location.pathname === "/" || location.pathname === "/daily-summary"));
          return (
            <button
              key={tab.route}
              onClick={() => navigate(tab.route)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors touch-target",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
        <button
          onClick={onMoreClick}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground touch-target"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomTabs;
