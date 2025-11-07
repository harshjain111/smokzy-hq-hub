import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, UserCircle } from "lucide-react";

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
            .single();

          let venueName = null;
          if (roleData?.venue_id) {
            const { data: venueData } = await supabase
              .from("venues")
              .select("name")
              .eq("id", roleData.venue_id)
              .single();
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
      const email = `${phone}@smokzy.com`;
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed");

      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: authData.user.id,
          full_name: fullName,
          phone,
        });

      if (profileError) throw profileError;

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role,
          venue_id: role === "employee" ? venueId : null,
        });

      if (roleError) throw roleError;

      toast.success("Employee created successfully");
      setFullName("");
      setPhone("");
      setPassword("");
      setRole("employee");
      setVenueId("");
      setOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to create employee");
    }
  };

  if (loading) {
    return <div>Loading employees...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Employee Management</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription>
                Create a new employee account
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
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
              <Button type="submit" className="w-full">Create Employee</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {employees.map((employee) => (
          <Card key={employee.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">{employee.full_name}</CardTitle>
              </div>
              <CardDescription>
                <div className="space-y-1 text-sm">
                  <div>Phone: {employee.phone || "N/A"}</div>
                  <div className="capitalize">Role: {employee.role}</div>
                  {employee.venue_name && <div>Venue: {employee.venue_name}</div>}
                </div>
              </CardDescription>
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
