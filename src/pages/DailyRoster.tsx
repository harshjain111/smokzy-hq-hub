import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  UserPlus, Trash2, RotateCcw,
  Calendar as CalendarIcon, Pencil, Plus, History, Check, Clock, FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Venue { id: string; name: string; }
interface StaffOption { id: string; full_name: string; }

interface RosterRow {
  id?: string;
  staff_id: string;
  staff_name: string;
  role: string;
  shift_start: string | null;
  shift_end: string | null;
  source: "weekly" | "added" | "modified";
  note: string;
  is_removed: boolean;
  _original?: Partial<RosterRow>;
  _isNew?: boolean;
}

interface VenueRoster {
  status: "draft" | "confirmed";
  confirmed_at: string | null;
  edit_count: number;
  rows: RosterRow[];
}

interface AuditEntry {
  id: string;
  action: string;
  user_id: string;
  user_name?: string;
  before_data: any;
  after_data: any;
  created_at: string;
}

interface SavedRosterSummary {
  date: string;
  venues: { venue_id: string; venue_name: string; status: string; staff_count: number; edit_count: number }[];
}

const ROLES = ["Captain", "Hookah Master", "Steward", "Helper", "Barman", "DJ", "Bouncer", "Staff"];
const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getTomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const DailyRoster = () => {
  const [selectedDate, setSelectedDate] = useState(() => getTomorrow());
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("all");
  const [venueRosters, setVenueRosters] = useState<Map<string, VenueRoster>>(new Map());
  const [allStaff, setAllStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditVenueId, setAuditVenueId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("editor");
  const [savedRosters, setSavedRosters] = useState<SavedRosterSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dateStr = formatDate(selectedDate);

  useEffect(() => { fetchVenues(); fetchStaff(); }, []);
  useEffect(() => { if (venues.length > 0) fetchDailyData(); }, [selectedDate, venues]);
  useEffect(() => { if (activeTab === "history" && venues.length > 0) fetchSavedRosters(); }, [activeTab, venues]);

  const fetchVenues = async () => {
    const { data } = await supabase.from("venues").select("id, name").order("name");
    setVenues(data || []);
  };

  const fetchStaff = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
    setAllStaff(data || []);
  };

  const fetchSavedRosters = async () => {
    setHistoryLoading(true);
    try {
      // Get distinct dates that have saved rosters, ordered desc
      const { data } = await supabase
        .from("daily_roster")
        .select("date, venue_id, status, edit_count, staff_id, is_removed")
        .order("date", { ascending: false });

      if (!data || data.length === 0) {
        setSavedRosters([]);
        setHistoryLoading(false);
        return;
      }

      const venueMap = new Map(venues.map(v => [v.id, v.name]));
      const byDate = new Map<string, Map<string, { status: string; staff_count: number; edit_count: number }>>();

      for (const row of data) {
        if (!byDate.has(row.date)) byDate.set(row.date, new Map());
        const dateMap = byDate.get(row.date)!;
        if (!dateMap.has(row.venue_id)) {
          dateMap.set(row.venue_id, { status: row.status, staff_count: 0, edit_count: row.edit_count });
        }
        const entry = dateMap.get(row.venue_id)!;
        if (!row.is_removed) entry.staff_count++;
      }

      const summaries: SavedRosterSummary[] = [];
      for (const [date, venueData] of byDate) {
        const venuesList = Array.from(venueData.entries()).map(([venue_id, info]) => ({
          venue_id,
          venue_name: venueMap.get(venue_id) || "Unknown",
          status: info.status,
          staff_count: info.staff_count,
          edit_count: info.edit_count,
        }));
        summaries.push({ date, venues: venuesList });
      }

      setSavedRosters(summaries);
    } catch {
      toast.error("Failed to load roster history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchDailyData = async () => {
    setLoading(true);
    const { data: existing } = await supabase
      .from("daily_roster")
      .select("*")
      .eq("date", dateStr);

    const profileMap = new Map(allStaff.map(s => [s.id, s.full_name]));

    if (existing && existing.length > 0) {
      const ids = [...new Set(existing.map(r => r.staff_id))];
      const missing = ids.filter(id => !profileMap.has(id));
      if (missing.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", missing);
        (profiles || []).forEach(p => profileMap.set(p.id, p.full_name));
      }
    }

    const map = new Map<string, VenueRoster>();

    if (existing && existing.length > 0) {
      for (const venue of venues) {
        const venueRows = existing.filter(r => r.venue_id === venue.id);
        if (venueRows.length === 0) {
          const rows = await prefillFromWeekly(venue.id, dateStr, profileMap);
          map.set(venue.id, { status: "draft", confirmed_at: null, edit_count: 0, rows });
        } else {
          const firstRow = venueRows[0];
          map.set(venue.id, {
            status: (firstRow.status as "draft" | "confirmed") || "draft",
            confirmed_at: firstRow.confirmed_at,
            edit_count: firstRow.edit_count || 0,
            rows: venueRows.map(r => ({
              id: r.id,
              staff_id: r.staff_id,
              staff_name: profileMap.get(r.staff_id) || "Unknown",
              role: r.role || "Staff",
              shift_start: r.shift_start,
              shift_end: r.shift_end,
              source: (r.source as RosterRow["source"]) || "weekly",
              note: r.note || "",
              is_removed: r.is_removed || false,
            })),
          });
        }
      }
    } else {
      for (const venue of venues) {
        const rows = await prefillFromWeekly(venue.id, dateStr, profileMap);
        map.set(venue.id, { status: "draft", confirmed_at: null, edit_count: 0, rows });
      }
    }

    setVenueRosters(map);
    setLoading(false);
  };

  const prefillFromWeekly = async (venueId: string, date: string, profileMap: Map<string, string>): Promise<RosterRow[]> => {
    const { data: weekly } = await supabase
      .from("roster_assignments")
      .select("staff_id, shift_start, shift_end, status, remarks")
      .eq("venue_id", venueId)
      .eq("date", date)
      .eq("status", "assigned");

    if (!weekly || weekly.length === 0) return [];

    const missing = weekly.map(w => w.staff_id).filter(id => !profileMap.has(id));
    if (missing.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", missing);
      (profiles || []).forEach(p => profileMap.set(p.id, p.full_name));
    }

    return weekly.map(w => ({
      staff_id: w.staff_id,
      staff_name: profileMap.get(w.staff_id) || "Unknown",
      role: "Staff",
      shift_start: w.shift_start,
      shift_end: w.shift_end,
      source: "weekly" as const,
      note: "",
      is_removed: false,
      _original: {
        staff_id: w.staff_id,
        role: "Staff",
        shift_start: w.shift_start,
        shift_end: w.shift_end,
      },
    }));
  };

  const updateRow = (venueId: string, staffId: string, field: keyof RosterRow, value: any) => {
    setVenueRosters(prev => {
      const next = new Map(prev);
      const vr = next.get(venueId);
      if (!vr) return prev;
      const rows = vr.rows.map(r => {
        if (r.staff_id !== staffId) return r;
        const updated = { ...r, [field]: value };
        if (r.source === "weekly" && r._original) {
          const orig = r._original;
          const changed = updated.role !== orig.role ||
            updated.shift_start !== orig.shift_start ||
            updated.shift_end !== orig.shift_end ||
            updated.note !== "";
          if (changed) updated.source = "modified";
        }
        return updated;
      });
      next.set(venueId, { ...vr, rows });
      return next;
    });
  };

  const removeRow = (venueId: string, staffId: string) => {
    setVenueRosters(prev => {
      const next = new Map(prev);
      const vr = next.get(venueId);
      if (!vr) return prev;
      const rows = vr.rows.map(r =>
        r.staff_id === staffId ? { ...r, is_removed: true } : r
      );
      next.set(venueId, { ...vr, rows });
      return next;
    });
  };

  const addStaff = (venueId: string, staffId: string) => {
    const staff = allStaff.find(s => s.id === staffId);
    if (!staff) return;
    setVenueRosters(prev => {
      const next = new Map(prev);
      const vr = next.get(venueId) || { status: "draft" as const, confirmed_at: null, edit_count: 0, rows: [] };
      const existingIdx = vr.rows.findIndex(r => r.staff_id === staffId);
      if (existingIdx >= 0) {
        const rows = [...vr.rows];
        rows[existingIdx] = { ...rows[existingIdx], is_removed: false, source: "added" };
        next.set(venueId, { ...vr, rows });
      } else {
        next.set(venueId, {
          ...vr,
          rows: [...vr.rows, {
            staff_id: staffId,
            staff_name: staff.full_name,
            role: "Staff",
            shift_start: null,
            shift_end: null,
            source: "added",
            note: "",
            is_removed: false,
            _isNew: true,
          }],
        });
      }
      return next;
    });
  };

  const saveVenueRoster = async (venueId: string) => {
    const vr = venueRosters.get(venueId);
    if (!vr) return;

    const activeRows = vr.rows.filter(r => !r.is_removed);
    if (activeRows.length === 0) {
      toast.error("At least 1 staff must be assigned");
      return;
    }

    const staffIds = activeRows.map(r => r.staff_id);
    if (new Set(staffIds).size !== staffIds.length) {
      toast.error("Duplicate staff found");
      return;
    }

    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    const isFirstSave = vr.status === "draft";
    const now = new Date().toISOString();

    try {
      const { data: beforeData } = await supabase
        .from("daily_roster")
        .select("*")
        .eq("venue_id", venueId)
        .eq("date", dateStr);

      await supabase.from("daily_roster" as any).delete().eq("venue_id", venueId).eq("date", dateStr);

      const rowsToInsert = vr.rows.map(r => ({
        venue_id: venueId,
        date: dateStr,
        staff_id: r.staff_id,
        role: r.role,
        shift_start: r.shift_start,
        shift_end: r.shift_end,
        status: "confirmed" as const,
        confirmed_by: userId,
        confirmed_at: isFirstSave ? now : (vr.confirmed_at || now),
        last_edited_by: userId,
        last_edited_at: now,
        edit_count: isFirstSave ? 0 : vr.edit_count + 1,
        source: r.source,
        note: r.note || null,
        is_removed: r.is_removed,
      }));

      const { error } = await supabase.from("daily_roster" as any).insert(rowsToInsert);
      if (error) throw error;

      await supabase.from("roster_audit_log" as any).insert({
        venue_id: venueId,
        roster_date: dateStr,
        action: isFirstSave ? "confirmed" : "edited",
        user_id: userId,
        before_data: beforeData || [],
        after_data: rowsToInsert,
      });

      await supabase.from("incharge_daily_tasks" as any)
        .update({ status: "completed", completed_at: now })
        .eq("venue_id", venueId)
        .eq("task_date", dateStr)
        .eq("task_type", "confirm_daily_roster")
        .eq("status", "pending");

      setVenueRosters(prev => {
        const next = new Map(prev);
        next.set(venueId, {
          ...vr,
          status: "confirmed",
          confirmed_at: isFirstSave ? now : (vr.confirmed_at || now),
          edit_count: isFirstSave ? 0 : vr.edit_count + 1,
        });
        return next;
      });

      toast.success(isFirstSave
        ? `Daily Roster confirmed for ${dateStr}`
        : `Changes saved (edit #${vr.edit_count + 1})`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const resetToWeekly = async (venueId: string) => {
    const profileMap = new Map(allStaff.map(s => [s.id, s.full_name]));
    const rows = await prefillFromWeekly(venueId, dateStr, profileMap);

    const { data: { session } } = await supabase.auth.getSession();
    const beforeData = venueRosters.get(venueId)?.rows || [];
    await supabase.from("roster_audit_log" as any).insert({
      venue_id: venueId,
      roster_date: dateStr,
      action: "reset",
      user_id: session?.user?.id,
      before_data: beforeData,
      after_data: rows,
    });

    setVenueRosters(prev => {
      const next = new Map(prev);
      next.set(venueId, { status: "draft", confirmed_at: null, edit_count: 0, rows });
      return next;
    });

    await supabase.from("daily_roster" as any).delete().eq("venue_id", venueId).eq("date", dateStr);
    toast.success("Reset to weekly roster");
  };

  const fetchAuditLog = async (venueId: string) => {
    setAuditVenueId(venueId);
    const { data } = await supabase
      .from("roster_audit_log")
      .select("*")
      .eq("venue_id", venueId)
      .eq("roster_date", dateStr)
      .order("created_at", { ascending: false });

    if (data) {
      const userIds = [...new Set(data.map(d => d.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
        : { data: [] };
      const pMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
      setAuditLog(data.map(d => ({ ...d, user_name: pMap.get(d.user_id) || "System" })));
    }
    setAuditOpen(true);
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "weekly": return <span className="text-xs text-muted-foreground flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> Weekly</span>;
      case "modified": return <span className="text-xs text-warning flex items-center gap-1"><Pencil className="h-3 w-3" /> Modified</span>;
      case "added": return <span className="text-xs text-primary flex items-center gap-1"><Plus className="h-3 w-3" /> Added</span>;
      default: return null;
    }
  };

  const handleExportDailyPDF = () => {
    const doc = new jsPDF();
    const dateLabel = selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    doc.setFontSize(16);
    doc.text("Smokzy Daily Roster", 14, 15);
    doc.setFontSize(10);
    doc.text(dateLabel, 14, 22);

    let yPos = 30;
    const venuesToExport = selectedVenueId === "all" ? venues : venues.filter(v => v.id === selectedVenueId);

    venuesToExport.forEach(venue => {
      const vr = venueRosters.get(venue.id);
      if (!vr) return;
      const activeRows = vr.rows.filter(r => !r.is_removed);
      if (activeRows.length === 0) return;

      if (yPos > 250) { doc.addPage(); yPos = 15; }

      doc.setFontSize(12);
      doc.text(`${venue.name}`, 14, yPos);
      doc.setFontSize(8);
      doc.text(`Status: ${vr.status.toUpperCase()}${vr.edit_count > 0 ? ` | Edited ${vr.edit_count}x` : ""}`, 14, yPos + 5);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [["Staff", "Role", "Shift Start", "Shift End", "Source", "Note"]],
        body: activeRows.map(r => [
          r.staff_name,
          r.role,
          r.shift_start || "—",
          r.shift_end === "closing" ? "Till Closing" : (r.shift_end || "—"),
          r.source,
          r.note || "",
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [99, 65, 214] },
      });

      yPos = (doc as any).lastAutoTable?.finalY + 10 || yPos + 40;
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.text(`Generated on ${new Date().toLocaleString("en-IN")} | Page ${i}/${pageCount}`, 14, doc.internal.pageSize.height - 10);
    }

    doc.save(`Smokzy_Daily_Roster_${dateStr}.pdf`);
    toast.success("PDF downloaded");
  };

  const filteredVenues = selectedVenueId === "all" ? venues : venues.filter(v => v.id === selectedVenueId);

  const totalScheduled = Array.from(venueRosters.values()).reduce((s, vr) => s + vr.rows.filter(r => !r.is_removed).length, 0);
  const totalModified = Array.from(venueRosters.values()).reduce((s, vr) => s + vr.rows.filter(r => !r.is_removed && r.source !== "weekly").length, 0);

  const handleSelectHistoryDate = (date: string) => {
    setSelectedDate(new Date(date + "T00:00:00"));
    setActiveTab("editor");
  };

  return (
    <PageLayout title="Daily Roster" subtitle={selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}>
      <div className="space-y-4 pb-24">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="editor">Create / Edit Roster</TabsTrigger>
            <TabsTrigger value="history">Saved Rosters</TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="space-y-4">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Date picker */}
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-10 justify-start text-left font-normal min-w-[220px]", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "EEE, dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => { if (d) { setSelectedDate(d); setCalendarOpen(false); } }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              <Button variant="outline" size="sm" className="h-10" onClick={() => setSelectedDate(getTomorrow())}>
                Tomorrow
              </Button>
              <Button variant="outline" size="sm" className="h-10" onClick={() => setSelectedDate(new Date())}>
                Today
              </Button>

              <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
                <SelectTrigger className="w-[200px] h-10">
                  <SelectValue placeholder="All Venues" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Venues</SelectItem>
                  {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" className="h-10" onClick={handleExportDailyPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>

            {/* Venue Cards */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredVenues.map(venue => {
                  const vr = venueRosters.get(venue.id);
                  if (!vr) return null;
                  const activeRows = vr.rows.filter(r => !r.is_removed);
                  const modifiedCount = activeRows.filter(r => r.source !== "weekly").length;
                  const assignedStaffIds = new Set(vr.rows.filter(r => !r.is_removed).map(r => r.staff_id));
                  const availableStaff = allStaff.filter(s => !assignedStaffIds.has(s.id));

                  return (
                    <Card key={venue.id} className="rounded-xl">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <CardTitle className="text-base">{venue.name}</CardTitle>
                            <Badge variant={vr.status === "confirmed" ? "default" : "secondary"}
                              className={vr.status === "confirmed" ? "bg-green-600 text-white" : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200"}>
                              {vr.status === "confirmed" ? "CONFIRMED" : "DRAFT"}
                            </Badge>
                            {vr.edit_count > 0 && (
                              <span className="text-xs text-muted-foreground">Edited {vr.edit_count}×</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => fetchAuditLog(venue.id)}>
                              <History className="h-3.5 w-3.5 mr-1" /> History
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-9 text-xs text-destructive hover:text-destructive">
                                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reset to Weekly Roster?</AlertDialogTitle>
                                  <AlertDialogDescription>This will discard all manual edits and reload from the weekly plan.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => resetToWeekly(venue.id)}>Reset</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {activeRows.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">No staff assigned</p>
                        ) : (
                          activeRows.map(row => (
                            <div key={row.staff_id} className={`flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border ${row.source === "modified" ? "border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20" : "bg-card"}`}>
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                                  {row.staff_name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{row.staff_name}</p>
                                  {getSourceBadge(row.source)}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <Select value={row.role} onValueChange={v => updateRow(venue.id, row.staff_id, "role", v)}>
                                  <SelectTrigger className="w-[130px] h-9 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                  </SelectContent>
                                </Select>

                                <Input
                                  type="time"
                                  value={row.shift_start || ""}
                                  onChange={e => updateRow(venue.id, row.staff_id, "shift_start", e.target.value || null)}
                                  className="w-[110px] h-9 text-xs"
                                  placeholder="Start"
                                />
                                {row.shift_end === "closing" ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => updateRow(venue.id, row.staff_id, "shift_end", null)}
                                    className="w-[110px] h-9 text-xs font-medium border-primary text-primary"
                                    title="Click to set a specific end time"
                                  >
                                    Till Closing
                                  </Button>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="time"
                                      value={row.shift_end || ""}
                                      onChange={e => updateRow(venue.id, row.staff_id, "shift_end", e.target.value || null)}
                                      className="w-[110px] h-9 text-xs"
                                      placeholder="End"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => updateRow(venue.id, row.staff_id, "shift_end", "closing")}
                                      className="h-9 px-2 text-[10px] whitespace-nowrap"
                                      title="Set as Till Closing"
                                    >
                                      Closing
                                    </Button>
                                  </div>
                                )}

                                <Input
                                  value={row.note}
                                  onChange={e => updateRow(venue.id, row.staff_id, "note", e.target.value)}
                                  className="w-[150px] h-9 text-xs"
                                  placeholder="Note..."
                                />

                                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => removeRow(venue.id, row.staff_id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}

                        {availableStaff.length > 0 && (
                          <Select onValueChange={v => addStaff(venue.id, v)}>
                            <SelectTrigger className="h-10 border-dashed">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <UserPlus className="h-4 w-4" />
                                <span className="text-sm">Add Staff</span>
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {availableStaff.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-xs text-muted-foreground">
                            {activeRows.length} staff scheduled{modifiedCount > 0 ? ` · ${modifiedCount} modified` : ""}
                          </span>
                          <Button size="sm" className="h-10 min-w-[180px]" onClick={() => saveVenueRoster(venue.id)} disabled={saving}>
                            {saving ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                            {vr.status === "draft" ? "Confirm & Save" : "Save Changes"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <p className="text-sm text-muted-foreground">Previously saved daily rosters. Click on a date to view or edit it.</p>

            {historyLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : savedRosters.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No saved rosters found.
              </div>
            ) : (
              <div className="space-y-3">
                {savedRosters.map(sr => {
                  const d = new Date(sr.date + "T00:00:00");
                  const isToday = formatDate(new Date()) === sr.date;
                  const isTomorrow = formatDate(getTomorrow()) === sr.date;
                  const totalStaff = sr.venues.reduce((s, v) => s + v.staff_count, 0);
                  const allConfirmed = sr.venues.every(v => v.status === "confirmed");

                  return (
                    <Card
                      key={sr.date}
                      className="rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSelectHistoryDate(sr.date)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
                              <span className="text-xs font-medium text-primary">{d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                              <span className="text-lg font-bold text-primary leading-tight">{d.getDate()}</span>
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                                {isToday && <Badge variant="secondary" className="ml-2 text-xs">Today</Badge>}
                                {isTomorrow && <Badge variant="secondary" className="ml-2 text-xs">Tomorrow</Badge>}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {sr.venues.length} venue{sr.venues.length > 1 ? "s" : ""} · {totalStaff} staff
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={allConfirmed ? "default" : "secondary"}
                              className={allConfirmed ? "bg-green-600 text-white" : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200"}>
                              {allConfirmed ? "CONFIRMED" : "DRAFT"}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sr.venues.map(v => (
                            <span key={v.venue_id} className="text-xs bg-muted px-2 py-1 rounded-full">
                              {v.venue_name}: {v.staff_count} staff
                              {v.edit_count > 0 && ` · ${v.edit_count} edits`}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom sticky summary bar — only in editor tab */}
      {!loading && activeTab === "editor" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t px-4 py-3 flex items-center justify-between safe-area-bottom md:left-[240px] lg:left-[240px]">
          <span className="text-sm text-muted-foreground">
            {totalScheduled} staff total{totalModified > 0 ? ` · ${totalModified} modified` : ""}
          </span>
          <Button
            onClick={async () => {
              for (const venue of filteredVenues) {
                await saveVenueRoster(venue.id);
              }
            }}
            disabled={saving}
            className="h-11 px-6"
          >
            {saving ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Confirm All
          </Button>
        </div>
      )}

      {/* Audit trail drawer */}
      <Sheet open={auditOpen} onOpenChange={setAuditOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Roster History — {venues.find(v => v.id === auditVenueId)?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {auditLog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No history yet</p>
            ) : (
              auditLog.map(entry => (
                <div key={entry.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {entry.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <p className="text-sm">By {entry.user_name}</p>
                  {entry.action === "edited" && entry.before_data && entry.after_data && (
                    <div className="text-xs text-muted-foreground mt-1">
                      <p>Before: {Array.isArray(entry.before_data) ? entry.before_data.length : 0} rows</p>
                      <p>After: {Array.isArray(entry.after_data) ? entry.after_data.length : 0} rows</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </PageLayout>
  );
};

export default DailyRoster;
