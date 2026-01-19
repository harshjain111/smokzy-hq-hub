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
import { motion } from "framer-motion";

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
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header with animated gradient hero */}
      <header className="shrink-0 z-40 relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-gradient-start/15 via-gradient-end/10 to-transparent" />
        
        {/* Animated floating gradient orbs */}
        <motion.div
          className="absolute top-0 right-0 w-56 h-56 bg-gradient-to-bl from-gradient-start/30 via-gradient-end/25 to-transparent rounded-full blur-3xl"
          animate={{
            x: [0, 10, 0],
            y: [0, -8, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{ transform: "translate(25%, -50%)" }}
        />
        <motion.div
          className="absolute top-1/2 left-0 w-32 h-32 bg-gradient-to-r from-gradient-end/20 to-transparent rounded-full blur-2xl"
          animate={{
            x: [0, 15, 0],
            y: [0, 10, 0],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          style={{ transform: "translate(-50%, -50%)" }}
        />
        
        <div className="relative px-5 py-6">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-sm font-medium text-muted-foreground">
                {venueName || "Loading..."}
              </p>
              <h1 className="text-2xl font-bold text-foreground">Staff Portal</h1>
            </motion.div>
            <div className="flex items-center gap-3">
              {isCheckedIn && (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-xs bg-success/15 text-success px-3 py-1.5 rounded-full font-semibold border border-success/20"
                >
                  On Duty
                </motion.span>
              )}
              <ProfileMenu user={user} role="employee" />
            </div>
          </div>
        </div>
        {/* Bottom gradient line */}
        <div className="h-0.5 bg-gradient-to-r from-gradient-start via-gradient-end to-transparent" />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20">
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
