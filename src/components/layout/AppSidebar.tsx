import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, CalendarDays, CalendarCheck, Package, History,
  BarChart3, ClipboardCheck, ClipboardList, UserCheck, AlertTriangle,
  Users, CalendarClock, GraduationCap, Wrench, Camera, Building2,
  Leaf, Tag, Settings, Bell, User, TrendingUp, FileText, ListChecks,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItem {
  label: string;
  icon: React.ElementType;
  route: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "DASHBOARDS",
    items: [
      { label: "Today", icon: LayoutDashboard, route: "/dashboard" },
      { label: "Daily Summary", icon: FileText, route: "/daily-summary" },
      { label: "Weekly Summary", icon: TrendingUp, route: "/weekly-summary" },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { label: "Weekly Roster", icon: CalendarDays, route: "/roster/weekly" },
      { label: "Daily Roster", icon: CalendarCheck, route: "/roster/daily" },
      { label: "Packet Dispatch", icon: Package, route: "/packet-dispatch" },
      { label: "Dispatch History", icon: History, route: "/packet-dispatch/history" },
      { label: "Daily Club Report", icon: BarChart3, route: "/daily-report" },
    ],
  },
  {
    title: "QUALITY",
    items: [
      { label: "New Inspection", icon: ClipboardCheck, route: "/inspections/new" },
      { label: "Inspection History", icon: ClipboardList, route: "/inspections" },
      { label: "Inspection Checklist", icon: ListChecks, route: "/inspections/settings" },
      { label: "Staff Performance", icon: UserCheck, route: "/staff-performance" },
    ],
  },
  {
    title: "PEOPLE",
    items: [
      { label: "Manage Employees", icon: Users, route: "/manage-employees" },
      { label: "Attendance Report", icon: CalendarClock, route: "/attendance-report" },
    ],
  },
  {
    title: "ASSETS",
    items: [
      { label: "Accessory Tracker", icon: Wrench, route: "/accessories" },
      { label: "Counter Pictures", icon: Camera, route: "/counter-pictures" },
    ],
  },
  {
    title: "MASTER DATA",
    items: [
      { label: "Manage Venues", icon: Building2, route: "/manage-venues" },
      { label: "Manage Flavours", icon: Leaf, route: "/manage-flavours" },
      { label: "Hookah Categories", icon: Tag, route: "/manage-categories" },
    ],
  },
];

interface AppSidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
  role?: string;
}

const AppSidebar = ({ collapsed = false, onNavigate, role }: AppSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleNav = (route: string) => {
    navigate(route);
    onNavigate?.();
  };

  // Filter items based on role
  const filterGroups = (groups: NavGroup[]) => {
    if (role === "admin") return groups;
    if (role === "club_incharge") {
      return groups.map(g => ({
        ...g,
        items: g.items.filter(i => i.route !== "/manage-employees"),
      })).filter(g => g.items.length > 0);
    }
    if (role === "club_management") {
      // Club management: read-only access to dashboard + attendance + counter pictures
      const allowedRoutes = new Set([
        "/dashboard",
        "/attendance-report",
        "/counter-pictures",
      ]);
      return groups.map(g => ({
        ...g,
        items: g.items.filter(i => allowedRoutes.has(i.route)),
      })).filter(g => g.items.length > 0);
    }
    return groups;
  };

  const filtered = filterGroups(navGroups);

  return (
    <ScrollArea className="h-full">
      <nav className="py-4 px-3 space-y-6">
        {filtered.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <h3 className="px-3 mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                {group.title}
              </h3>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.route;
                return (
                  <button
                    key={item.route}
                    onClick={() => handleNav(item.route)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all touch-target",
                      collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                      isActive
                        ? "bg-[hsl(var(--nav-active))] text-primary border-l-[3px] border-l-[hsl(var(--nav-active-border))]"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-[3px] border-l-transparent"
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </ScrollArea>
  );
};

export default AppSidebar;
