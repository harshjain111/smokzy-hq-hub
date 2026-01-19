import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { useClubSession } from "@/hooks/useClubSession";
import BottomNav, { TabId } from "./BottomNav";
import AttendanceModule from "./AttendanceModule";
import StockModule from "./StockModule";
import SalesModule from "./SalesModule";
import PhotoModule from "./PhotoModule";
import ClosingModule from "./ClosingModule";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface StaffPortalProps {
  user: User;
  venueId: string;
}

const StaffPortal = ({ user, venueId }: StaffPortalProps) => {
  const [activeTab, setActiveTab] = useState<TabId>('attendance');
  
  const {
    session,
    myAttendanceBlock,
    loading,
    isCheckedIn,
    checkIn,
    checkOut,
    updateSessionTask,
    getCheckoutEligibility,
  } = useClubSession(user.id, venueId);

  const checkoutEligibility = getCheckoutEligibility();

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="mt-4 text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  // Render the active module
  const renderModule = () => {
    switch (activeTab) {
      case 'attendance':
        return (
          <AttendanceModule
            user={user}
            venueId={venueId}
            session={session}
            myAttendanceBlock={myAttendanceBlock}
            isCheckedIn={isCheckedIn}
            checkIn={checkIn}
            checkOut={checkOut}
            checkoutEligibility={checkoutEligibility}
          />
        );
      case 'stock':
        return (
          <StockModule
            user={user}
            venueId={venueId}
            session={session}
            updateSessionTask={updateSessionTask}
          />
        );
      case 'sales':
        return (
          <SalesModule
            user={user}
            venueId={venueId}
            session={session}
            updateSessionTask={updateSessionTask}
          />
        );
      case 'photo':
        return (
          <PhotoModule
            user={user}
            venueId={venueId}
            session={session}
            updateSessionTask={updateSessionTask}
          />
        );
      case 'closing':
        return (
          <ClosingModule
            session={session}
            venueId={venueId}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Smokzy</h1>
            {session && (
              <p className="text-xs text-muted-foreground">
                Session: {format(new Date(session.session_date), "MMM d, yyyy")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isCheckedIn && (
              <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full font-medium">
                On Duty
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative">
        {renderModule()}
      </main>

      {/* Bottom navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        session={session}
        isCheckedIn={isCheckedIn}
      />
    </div>
  );
};

export default StaffPortal;
