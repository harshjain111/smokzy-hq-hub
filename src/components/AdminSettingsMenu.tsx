import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Settings, Building2, Users, Tag, CalendarClock, Camera, Leaf, CalendarDays, CalendarCheck, Package, History } from "lucide-react";

const AdminSettingsMenu = () => {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Management</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/manage-venues")}>
          <Building2 className="mr-2 h-4 w-4" />
          Manage Venues
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/manage-employees")}>
          <Users className="mr-2 h-4 w-4" />
          Manage Employees
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/manage-categories")}>
          <Tag className="mr-2 h-4 w-4" />
          Hookah Categories
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/attendance-report")}>
          <CalendarClock className="mr-2 h-4 w-4" />
          Attendance Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/counter-pictures")}>
          <Camera className="mr-2 h-4 w-4" />
          Counter Pictures
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Club Incharge</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => navigate("/manage-flavours")}>
          <Leaf className="mr-2 h-4 w-4" />
          Manage Flavours
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/roster/weekly")}>
          <CalendarDays className="mr-2 h-4 w-4" />
          Weekly Roster
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/roster/daily")}>
          <CalendarCheck className="mr-2 h-4 w-4" />
          Daily Roster
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/packet-dispatch")}>
          <Package className="mr-2 h-4 w-4" />
          Packet Dispatch
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/packet-dispatch/history")}>
          <History className="mr-2 h-4 w-4" />
          Dispatch History
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AdminSettingsMenu;
