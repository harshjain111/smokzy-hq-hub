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
import { Settings, Building2, Users, Tag } from "lucide-react";

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
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AdminSettingsMenu;
