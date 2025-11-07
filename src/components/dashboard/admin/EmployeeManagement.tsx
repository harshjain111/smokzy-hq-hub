import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, UserCircle, Edit, Trash2 } from "lucide-react";

interface Employee {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  venue_name: string | null;
}

interface Venue {
  id: string;
  name: string;
}

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "employee">("employee");
  const [venueId, setVenueId] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [employeesRes, venuesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          phone
        `),
      supabase
        .from("venues")
        .select("id, name")
        .order("name"),
    ]);

    if (employeesRes.error) {
      toast.error("Failed to load employees");
    } else if (employeesRes.data) {
      const employeesWithRoles = await Promise.all(
        employeesRes.data.map(async (emp) => {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role, venue_id")
            .eq("user_id", emp.id)
            .maybeSingle();

          let venueName = null;
          if (roleData?.venue_id) {
            const { data: venueData } = await supabase
              .from("venues")
              .select("name")
              .eq("id", roleData.venue_id)
              .maybeSingle();
            venueName = venueData?.name || null;
          }

          return {
            ...emp,
            role: roleData?.role || "employee",
            venue_name: venueName,
          };
        })
      );
      setEmployees(employeesWithRoles);
    }

    if (venuesRes.error) {
      toast.error("Failed to load venues");
    } else {
      setVenues(venuesRes.data || []);
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (role === "employee" && !venueId) {
      toast.error("Please select a venue for the employee");
      return;
    }

    try {
      if (editingEmployee) {
        // Update existing employee via edge function
        const { data, error } = await supabase.functions.invoke('update-user', {
          body: {
            userId: editingEmployee.id,
            fullName,
            phone,
            password: password || undefined,
            role,
            venueId: role === "employee" ? venueId : null,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        toast.success("Employee updated successfully");
      } else {
        // Create new employee via edge function
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            fullName,
            phone,
            password,
            role,
            venueId: role === "employee" ? venueId : null,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        toast.success("Employee created successfully");
      }

      setFullName("");
      setPhone("");
      setPassword("");
      setRole("employee");
      setVenueId("");
      setEditingEmployee(null);
      setOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Submit error:', error);
      toast.error(error.message || `Failed to ${editingEmployee ? 'update' : 'create'} employee`);
    }
  };

  const handleEdit = async (employee: Employee) => {
    setEditingEmployee(employee);
    setFullName(employee.full_name);
    setPhone(employee.phone || "");
    setRole(employee.role as "admin" | "employee");
    
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("venue_id")
      .eq("user_id", employee.id)
      .maybeSingle();
    
    setVenueId(roleData?.venue_id || "");
    setOpen(true);
  };

  const handleDelete = async (employeeId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: employeeId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success("Employee deleted successfully");
      fetchData();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || "Failed to delete employee");
    }
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingEmployee(null);
    setFullName("");
    setPhone("");
    setPassword("");
    setRole("employee");
    setVenueId("");
  };

  if (loading) {
    return <div>Loading employees...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Employee Management</h2>
        <Dialog open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) handleCloseDialog();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {editingEmployee ? 'Edit Employee' : 'Add Employee'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
              <DialogDescription>
                {editingEmployee ? "Update employee information" : "Create a new employee account"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., 9876543210"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password {editingEmployee && "(leave blank to keep current)"}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required={!editingEmployee}
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(value: "admin" | "employee") => setRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {role === "employee" && (
                <div className="space-y-2">
                  <Label htmlFor="venue">Assign to Venue</Label>
                  <Select value={venueId} onValueChange={setVenueId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a venue" />
                    </SelectTrigger>
                    <SelectContent>
                      {venues.map((venue) => (
                        <SelectItem key={venue.id} value={venue.id}>
                          {venue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full">{editingEmployee ? "Update Employee" : "Create Employee"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {employees.map((employee) => (
          <Card key={employee.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <UserCircle className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <CardTitle className="text-lg">{employee.full_name}</CardTitle>
                    <div className="text-sm text-muted-foreground mt-1 space-y-1">
                      <div>Phone: {employee.phone || "N/A"}</div>
                      <div className="capitalize">Role: {employee.role}</div>
                      {employee.venue_name && <div>Venue: {employee.venue_name}</div>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEdit(employee)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{employee.full_name}"? This will permanently delete their account and all associated data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(employee.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
        {employees.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <p className="text-muted-foreground">No employees yet. Add your first employee to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EmployeeManagement;
