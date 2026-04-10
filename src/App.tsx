import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleGuard from "./components/RoleGuard";
import NotFound from "./pages/NotFound";
import MyProfile from "./pages/MyProfile";
import VenueDetail from "./pages/VenueDetail";
import VenueReports from "./pages/VenueReports";
import ManageVenues from "./pages/ManageVenues";
import ManageEmployees from "./pages/ManageEmployees";
import ManageCategories from "./pages/ManageCategories";
import ManageFlavours from "./pages/ManageFlavours";
import AttendanceReport from "./pages/AttendanceReport";
import CounterPictures from "./pages/CounterPictures";
import ClubDetail from "./pages/ClubDetail";
import WeeklyRoster from "./pages/WeeklyRoster";
import DailyRoster from "./pages/DailyRoster";
import PacketDispatch from "./pages/PacketDispatch";
import DispatchHistory from "./pages/DispatchHistory";
import DailyClubReport from "./pages/DailyClubReport";
import InspectionForm from "./pages/InspectionForm";
import InspectionHistory from "./pages/InspectionHistory";
import StaffPerformance from "./pages/StaffPerformance";
import WeeklySummary from "./pages/WeeklySummary";
import AccessoryTracker from "./pages/AccessoryTracker";

const queryClient = new QueryClient();

const INCHARGE_ROLES = ["admin", "club_incharge"] as const;
const ADMIN_ONLY = ["admin"] as const;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/club/:clubId" element={<ProtectedRoute><ClubDetail /></ProtectedRoute>} />
          <Route path="/venue/:venueId" element={<ProtectedRoute><VenueDetail /></ProtectedRoute>} />
          <Route path="/venue/:venueId/reports" element={<ProtectedRoute><VenueReports /></ProtectedRoute>} />

          {/* Admin-only routes */}
          <Route path="/manage-employees" element={<RoleGuard allowedRoles={[...ADMIN_ONLY]}><ManageEmployees /></RoleGuard>} />

          {/* Admin + Club Incharge routes */}
          <Route path="/manage-venues" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><ManageVenues /></RoleGuard>} />
          <Route path="/manage-categories" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><ManageCategories /></RoleGuard>} />
          <Route path="/manage-flavours" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><ManageFlavours /></RoleGuard>} />
          <Route path="/attendance-report" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><AttendanceReport /></RoleGuard>} />
          <Route path="/counter-pictures" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><CounterPictures /></RoleGuard>} />
          <Route path="/roster/weekly" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><WeeklyRoster /></RoleGuard>} />
          <Route path="/roster/daily" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><DailyRoster /></RoleGuard>} />
          <Route path="/packet-dispatch" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><PacketDispatch /></RoleGuard>} />
          <Route path="/packet-dispatch/history" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><DispatchHistory /></RoleGuard>} />
          <Route path="/daily-report" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><DailyClubReport /></RoleGuard>} />
          <Route path="/inspections" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><InspectionHistory /></RoleGuard>} />
          <Route path="/inspections/new" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><InspectionForm /></RoleGuard>} />
          <Route path="/staff-performance" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><StaffPerformance /></RoleGuard>} />
          <Route path="/weekly-summary" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><WeeklySummary /></RoleGuard>} />
          <Route path="/accessories" element={<RoleGuard allowedRoles={[...INCHARGE_ROLES]}><AccessoryTracker /></RoleGuard>} />

          <Route path="/my-profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
