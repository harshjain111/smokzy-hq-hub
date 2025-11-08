import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import MyProfile from "./pages/MyProfile";
import VenueDetail from "./pages/VenueDetail";
import VenueReports from "./pages/VenueReports";
import ManageVenues from "./pages/ManageVenues";
import ManageEmployees from "./pages/ManageEmployees";
import ManageCategories from "./pages/ManageCategories";
import AttendanceReport from "./pages/AttendanceReport";
import CounterPictures from "./pages/CounterPictures";

const queryClient = new QueryClient();

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
          <Route path="/venue/:venueId" element={<ProtectedRoute><VenueDetail /></ProtectedRoute>} />
          <Route path="/venue/:venueId/reports" element={<ProtectedRoute><VenueReports /></ProtectedRoute>} />
          <Route path="/manage-venues" element={<ProtectedRoute><ManageVenues /></ProtectedRoute>} />
          <Route path="/manage-employees" element={<ProtectedRoute><ManageEmployees /></ProtectedRoute>} />
          <Route path="/manage-categories" element={<ProtectedRoute><ManageCategories /></ProtectedRoute>} />
          <Route path="/attendance-report" element={<ProtectedRoute><AttendanceReport /></ProtectedRoute>} />
          <Route path="/counter-pictures" element={<ProtectedRoute><CounterPictures /></ProtectedRoute>} />
          <Route path="/my-profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
