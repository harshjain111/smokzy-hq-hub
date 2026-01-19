import { ClubSession } from "@/hooks/useClubSession";
import { cn } from "@/lib/utils";
import { Clock, Package, TrendingUp, Camera, CheckCircle, Lock } from "lucide-react";

export type TabId = 'attendance' | 'stock' | 'sales' | 'photo' | 'closing';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  session: ClubSession | null;
  isCheckedIn: boolean;
}

type TabStatus = 'pending' | 'in_progress' | 'completed' | 'locked';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const tabs: TabConfig[] = [
  { id: 'attendance', label: 'Attendance', icon: Clock },
  { id: 'stock', label: 'Stock', icon: Package },
  { id: 'sales', label: 'Sales', icon: TrendingUp },
  { id: 'photo', label: 'Photo', icon: Camera },
  { id: 'closing', label: 'Closing', icon: CheckCircle },
];

const BottomNav = ({ activeTab, onTabChange, session, isCheckedIn }: BottomNavProps) => {
  const getTabStatus = (tabId: TabId): TabStatus => {
    // If not checked in, only attendance is accessible
    if (!isCheckedIn) {
      return tabId === 'attendance' ? 'pending' : 'locked';
    }

    // If no session yet, all tabs except attendance are locked
    if (!session) {
      return tabId === 'attendance' ? 'completed' : 'locked';
    }

    switch (tabId) {
      case 'attendance':
        return 'completed';
      case 'stock':
        return session.stock_submitted ? 'completed' : 'pending';
      case 'sales':
        return session.sales_submitted ? 'completed' : 'pending';
      case 'photo':
        return session.photo_uploaded ? 'completed' : 'pending';
      case 'closing':
        const allComplete = session.stock_submitted && session.sales_submitted && session.photo_uploaded;
        return allComplete ? 'completed' : (session.status === 'open' ? 'in_progress' : 'completed');
      default:
        return 'pending';
    }
  };

  const getStatusIndicator = (status: TabStatus) => {
    switch (status) {
      case 'pending':
        return <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-destructive rounded-full animate-pulse" />;
      case 'in_progress':
        return <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-warning rounded-full" />;
      case 'completed':
        return <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full" />;
      case 'locked':
        return <Lock className="absolute -top-0.5 -right-0.5 w-3 h-3 text-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border safe-area-pb">
      <div className="grid grid-cols-5 h-[68px]">
        {tabs.map((tab) => {
          const status = getTabStatus(tab.id);
          const isActive = activeTab === tab.id;
          const isLocked = status === 'locked';
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => !isLocked && onTabChange(tab.id)}
              disabled={isLocked}
              className={cn(
                "flex flex-col items-center justify-center gap-1 relative transition-all",
                isActive 
                  ? "text-primary" 
                  : isLocked 
                    ? "text-muted-foreground/40 cursor-not-allowed" 
                    : "text-muted-foreground active:scale-95",
              )}
            >
              <div className="relative">
                <div className={cn(
                  "p-1.5 rounded-xl transition-colors",
                  isActive && "bg-primary/10"
                )}>
                  <Icon className={cn("w-5 h-5", isActive && "text-primary")} />
                </div>
                {getStatusIndicator(status)}
              </div>
              <span className={cn(
                "text-[10px] font-medium leading-tight",
                isActive && "text-primary"
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
