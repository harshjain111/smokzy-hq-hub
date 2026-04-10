import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy, Save, Loader2, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Venue {
  id: string;
  name: string;
}

interface Employee {
  user_id: string;
  full_name: string;
  venue_id: string;
  venue_name: string;
}

interface RosterCell {
  staff_id: string;
  date: string;
  venue_id: string;
  status: string;
  id?: string;
}

const getWeekStart = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDate = (d: Date): string => d.toISOString().split("T")[0];

const getDayLabel = (d: Date): string =>
  d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

const WeeklyRoster = () => {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [venues, setVenues] = useState<Venue[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<Map<string, RosterCell>>(new Map());
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const weekEndStr = formatDate(weekDates[6]);

  useEffect(() => {
    fetchVenuesAndEmployees();
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [weekStart]);

  const fetchVenuesAndEmployees = async () => {
    const [{ data: v }, { data: e }] = await Promise.all([
      supabase.from("venues").select("id, name").order("name"),
      supabase
        .from("user_roles")
        .select("user_id, venue_id, role")
        .eq("role", "employee"),
    ]);

    setVenues(v || []);

    if (e) {
      const userIds = e.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const venueMap = new Map((v || []).map((x) => [x.id, x.name]));
      const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

      setEmployees(
        e.map((r) => ({
          user_id: r.user_id,
          full_name: profileMap.get(r.user_id) || "Unknown",
          venue_id: r.venue_id || "",
          venue_name: venueMap.get(r.venue_id || "") || "Unassigned",
        }))
      );
    }
  };

  const fetchAssignments = async () => {
    const startStr = formatDate(weekStart);
    const { data } = await supabase
      .from("roster_assignments")
      .select("*")
      .gte("date", startStr)
      .lte("date", weekEndStr);

    const map = new Map<string, RosterCell>();
    (data || []).forEach((a: any) => {
      map.set(`${a.staff_id}_${a.date}`, {
        staff_id: a.staff_id,
        date: a.date,
        venue_id: a.venue_id,
        status: a.status,
        id: a.id,
      });
    });
    setAssignments(map);
    setDirty(false);
  };

  const cellKey = (staffId: string, date: Date) => `${staffId}_${formatDate(date)}`;

  const setCellValue = (staffId: string, date: Date, value: string) => {
    const key = cellKey(staffId, date);
    const newMap = new Map(assignments);

    if (value === "OFF" || value === "LEAVE") {
      newMap.set(key, {
        staff_id: staffId,
        date: formatDate(date),
        venue_id: "",
        status: value.toLowerCase(),
      });
    } else if (value === "CLEAR") {
      newMap.delete(key);
    } else {
      newMap.set(key, {
        staff_id: staffId,
        date: formatDate(date),
        venue_id: value,
        status: "assigned",
      });
    }
    setAssignments(newMap);
    setDirty(true);
  };

  const getCellValue = (staffId: string, date: Date): string => {
    const cell = assignments.get(cellKey(staffId, date));
    if (!cell) return "";
    if (cell.status === "off") return "OFF";
    if (cell.status === "leave") return "LEAVE";
    return cell.venue_id;
  };

  const handleCopyPreviousWeek = async () => {
    const prevStart = new Date(weekStart);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(prevStart);
    prevEnd.setDate(prevEnd.getDate() + 6);

    const { data } = await supabase
      .from("roster_assignments")
      .select("*")
      .gte("date", formatDate(prevStart))
      .lte("date", formatDate(prevEnd));

    if (!data || data.length === 0) {
      toast.error("No assignments found in previous week to copy");
      return;
    }

    const newMap = new Map(assignments);
    data.forEach((a: any) => {
      const oldDate = new Date(a.date);
      const newDate = new Date(oldDate);
      newDate.setDate(newDate.getDate() + 7);
      const key = `${a.staff_id}_${formatDate(newDate)}`;

      if (!newMap.has(key)) {
        newMap.set(key, {
          staff_id: a.staff_id,
          date: formatDate(newDate),
          venue_id: a.venue_id,
          status: a.status,
        });
      }
    });

    setAssignments(newMap);
    setDirty(true);
    toast.success(`Copied ${data.length} assignments from previous week`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const startStr = formatDate(weekStart);
      const user = (await supabase.auth.getUser()).data.user;

      // Delete existing assignments for this week
      await supabase
        .from("roster_assignments")
        .delete()
        .gte("date", startStr)
        .lte("date", weekEndStr);

      // Insert new assignments
      const rows = Array.from(assignments.values())
        .filter((a) => a.venue_id || a.status === "off" || a.status === "leave")
        .map((a) => ({
          staff_id: a.staff_id,
          venue_id: a.status === "off" || a.status === "leave"
            ? employees.find((e) => e.user_id === a.staff_id)?.venue_id || venues[0]?.id
            : a.venue_id,
          date: a.date,
          status: a.status,
          assigned_by: user?.id || "",
          week_start_date: startStr,
        }));

      if (rows.length > 0) {
        const { error } = await supabase.from("roster_assignments").insert(rows);
        if (error) throw error;
      }

      toast.success(`Saved ${rows.length} assignments`);
      setDirty(false);
      fetchAssignments();
    } catch (err: any) {
      toast.error(err.message || "Failed to save roster");
    } finally {
      setSaving(false);
    }
  };

  const navigateWeek = (dir: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + dir * 7);
    setWeekStart(next);
  };

  const getVenueChipColor = (venueId: string): string => {
    const colors = [
      "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
      "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    ];
    const idx = venues.findIndex((v) => v.id === venueId);
    return colors[idx % colors.length] || colors[0];
  };

  const sortedEmployees = [...employees].sort((a, b) =>
    a.full_name.localeCompare(b.full_name)
  );

  return (
    <PageLayout title="Weekly Roster" subtitle={`Week of ${getDayLabel(weekStart)} — ${getDayLabel(weekDates[6])}`}>
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(getWeekStart(new Date()))}>
              This Week
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateWeek(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCopyPreviousWeek}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Previous Week
            </Button>
            {!dirty && sortedEmployees.length > 0 && (
              <Button variant="outline" onClick={handleExportWeeklyPDF}>
                <FileDown className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            )}
            <Button onClick={handleSave} disabled={!dirty || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Roster
            </Button>
          </div>
        </div>

        {/* Roster Grid */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="sticky left-0 bg-muted/50 z-10 p-3 text-left font-medium min-w-[160px]">
                      Staff
                    </th>
                    {weekDates.map((d) => (
                      <th key={formatDate(d)} className="p-3 text-center font-medium min-w-[130px]">
                        <div>{d.toLocaleDateString("en-IN", { weekday: "short" })}</div>
                        <div className="text-xs text-muted-foreground">
                          {d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedEmployees.map((emp) => (
                    <tr key={emp.user_id} className="border-b hover:bg-muted/30">
                      <td className="sticky left-0 bg-background z-10 p-3 font-medium">
                        <div>{emp.full_name}</div>
                        <div className="text-xs text-muted-foreground">{emp.venue_name}</div>
                      </td>
                      {weekDates.map((d) => {
                        const val = getCellValue(emp.user_id, d);
                        return (
                          <td key={formatDate(d)} className="p-1.5 text-center">
                            <Select
                              value={val}
                              onValueChange={(v) => setCellValue(emp.user_id, d, v)}
                            >
                              <SelectTrigger
                                className={`h-8 text-xs ${
                                  val === "OFF"
                                    ? "bg-muted text-muted-foreground"
                                    : val === "LEAVE"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                    : val
                                    ? getVenueChipColor(val)
                                    : ""
                                }`}
                              >
                                <SelectValue placeholder="—">
                                  {val === "OFF"
                                    ? "OFF"
                                    : val === "LEAVE"
                                    ? "LEAVE"
                                    : val
                                    ? venues.find((v) => v.id === val)?.name?.substring(0, 12) || "—"
                                    : "—"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="bg-background z-50">
                                <SelectItem value="CLEAR">— Clear —</SelectItem>
                                <SelectItem value="OFF">OFF</SelectItem>
                                <SelectItem value="LEAVE">LEAVE</SelectItem>
                                {venues.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {sortedEmployees.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No employees found. Add employees first.
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default WeeklyRoster;
