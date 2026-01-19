import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useClubSession } from "@/hooks/useClubSession";
import BottomNav, { TabId } from "./BottomNav";
import AttendanceModule from "./AttendanceModule";
import StockModule from "./StockModule";
import SalesModule from "./SalesModule";
import PhotoModule from "./PhotoModule";
import ClosingModule from "./ClosingModule";
import ProfileMenu from "@/components/ProfileMenu";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface StaffPortalProps {
  user: User;
  venueId: string;
}

const StaffPortal = ({ user, venueId }: StaffPortalProps) => {
  const [activeTab, setActiveTab] = useState<TabId>('attendance');
  const [venueName, setVenueName] = useState<string>("");
  
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

  useEffect(() => {
    const fetchVenueName = async () => {
      const { data } = await supabase
        .from("venues")
        .select("name")
        .eq("id", venueId)
        .single();
      if (data?.name) {
        setVenueName(data.name);
      }
    };
    fetchVenueName();
  }, [venueId]);

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
    <div className="h-screen bg-background pb-16 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 z-40 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-primary">Smokzy Operations</h1>
            <p className="text-xs text-muted-foreground">
              {venueName || "Loading..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isCheckedIn && (
              <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full font-medium">
                On Duty
              </span>
            )}
            <ProfileMenu user={user} role="employee" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
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
