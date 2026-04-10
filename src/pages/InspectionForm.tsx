import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";
import {
  Camera,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Send,
} from "lucide-react";

interface CheckItem {
  key: string;
  label: string;
  icon: string;
}

const DEFAULT_CHECKS: CheckItem[] = [
  { key: "staff_grooming", label: "Staff Grooming", icon: "👔" },
  { key: "venue_cleanliness", label: "Venue Cleanliness", icon: "🧹" },
  { key: "hookah_quality", label: "Hookah Quality", icon: "💨" },
  { key: "music_ambience", label: "Music & Ambience", icon: "🎵" },
  { key: "inventory_check", label: "Inventory Check", icon: "📦" },
  { key: "safety_compliance", label: "Safety Compliance", icon: "🛡️" },
  { key: "customer_feedback", label: "Customer Feedback", icon: "⭐" },
  { key: "staff_behavior", label: "Staff Behavior", icon: "🤝" },
  { key: "billing_accuracy", label: "Billing Accuracy", icon: "💳" },
  { key: "opening_procedure", label: "Opening Procedure", icon: "🔓" },
  { key: "closing_procedure", label: "Closing Procedure", icon: "🔒" },
  { key: "equipment_condition", label: "Equipment Condition", icon: "🔧" },
];

interface SpotCheckFlavour {
  id: string;
  name: string;
  reported: string;
  measured: string;
}

const InspectionForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedVenue = searchParams.get("venue");

  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [selectedVenue, setSelectedVenue] = useState(preselectedVenue || "");
  const [CHECKS, setCHECKS] = useState<CheckItem[]>(DEFAULT_CHECKS);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [remarks, setRemarks] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [spotChecks, setSpotChecks] = useState<SpotCheckFlavour[]>([]);
  const [loadingSpotChecks, setLoadingSpotChecks] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Violation fields — support multiple
  interface ViolationEntry {
    staffId: string;
    type: string;
    severity: string;
    description: string;
  }
  const [violationNoted, setViolationNoted] = useState(false);
  const [violations, setViolations] = useState<ViolationEntry[]>([
    { staffId: "", type: "", severity: "low", description: "" },
  ]);
  const [venueStaff, setVenueStaff] = useState<{ id: string; name: string }[]>([]);

  const addViolation = () => {
    setViolations((prev) => [...prev, { staffId: "", type: "", severity: "low", description: "" }]);
  };

  const updateViolation = (index: number, field: keyof ViolationEntry, value: string) => {
    setViolations((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  const removeViolation = (index: number) => {
    setViolations((prev) => prev.filter((_, i) => i !== index));
    if (violations.length <= 1) setViolationNoted(false);
  };

  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("venues").select("id, name").order("name").then(({ data }) => setVenues(data || []));
    // Load custom checklist from global_settings
    supabase.from("global_settings").select("value").eq("key", "inspection_checklist").single().then(({ data }) => {
      let checkItems = DEFAULT_CHECKS;
      if (data?.value) {
        try { checkItems = JSON.parse(data.value); } catch {}
      }
      setCHECKS(checkItems);
      const init: Record<string, boolean> = {};
      checkItems.forEach(c => (init[c.key] = false));
      setChecks(init);
    });
  }, []);

  // When venue changes, pick random spot-check flavours + fetch staff
  useEffect(() => {
    if (!selectedVenue) return;
    pickSpotCheckFlavours(selectedVenue);
    fetchVenueStaff(selectedVenue);
  }, [selectedVenue]);

  const fetchVenueStaff = async (venueId: string) => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "employee")
      .eq("venue_id", venueId);

    if (roles && roles.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", roles.map((r) => r.user_id));
      setVenueStaff((profiles || []).map((p) => ({ id: p.id, name: p.full_name })));
    } else {
      setVenueStaff([]);
    }
  };

  const pickSpotCheckFlavours = async (venueId: string) => {
    setLoadingSpotChecks(true);
    // Get flavours from recent dispatches to this venue (last 14 days)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const { data: dispatches } = await supabase
      .from("packet_dispatches")
      .select("flavour_id")
      .eq("venue_id", venueId)
      .gte("date", twoWeeksAgo.toISOString().split("T")[0]);

    // Get unique flavour IDs from recent dispatches
    const uniqueFlavourIds = [...new Set((dispatches || []).map((d) => d.flavour_id))];

    if (uniqueFlavourIds.length === 0) {
      // Fallback: pick from all active flavours
      const { data: allFlavours } = await supabase
        .from("flavours")
        .select("id, name")
        .eq("is_active", true);
      const shuffled = (allFlavours || []).sort(() => Math.random() - 0.5);
      setSpotChecks(
        shuffled.slice(0, 3).map((f) => ({
          id: f.id,
          name: f.name,
          reported: "",
          measured: "",
        }))
      );
    } else {
      // Pick 3 random from recent dispatch flavours
      const { data: flavourDetails } = await supabase
        .from("flavours")
        .select("id, name")
        .in("id", uniqueFlavourIds);

      const shuffled = (flavourDetails || []).sort(() => Math.random() - 0.5);
      setSpotChecks(
        shuffled.slice(0, 3).map((f) => ({
          id: f.id,
          name: f.name,
          reported: "",
          measured: "",
        }))
      );
    }
    setLoadingSpotChecks(false);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const toggleCheck = (key: string) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const score = CHECKS.filter((c) => checks[c.key]).length;
  const totalChecks = CHECKS.length;
  const scorePercent = Math.round((score / totalChecks) * 100);

  const handleSubmit = async () => {
    if (!selectedVenue) {
      toast.error("Please select a club");
      return;
    }
    setSubmitting(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");

      // Upload photo if provided
      let photoUrl: string | null = null;
      if (photoFile) {
        const compressed = await compressImage(photoFile, { maxSizeMB: 0.5 });
        const fileName = `inspection_${selectedVenue}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("kot-photos") // reuse existing bucket
          .upload(fileName, compressed, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("kot-photos").getPublicUrl(fileName);
        photoUrl = urlData.publicUrl;
      }

      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0]; // HH:MM:SS

      // Insert inspection
      const { data: inspection, error: inspError } = await supabase
        .from("inspections")
        .insert({
          venue_id: selectedVenue,
          inspector_id: user.id,
          date: now.toISOString().split("T")[0],
          time: timeStr,
          ...checks,
          remarks: remarks || null,
          photo_url: photoUrl,
          violation_noted: violationNoted,
          score: scorePercent,
        })
        .select("id")
        .single();

      if (inspError) throw inspError;

      // Insert stock spot checks
      const spotCheckRows = spotChecks
        .filter((sc) => sc.measured !== "")
        .map((sc) => ({
          inspection_id: inspection.id,
          flavour_id: sc.id,
          reported_stock: parseInt(sc.reported) || 0,
          measured_stock: parseInt(sc.measured) || 0,
          match: parseInt(sc.reported || "0") === parseInt(sc.measured || "0"),
        }));

      if (spotCheckRows.length > 0) {
        const { error: scError } = await supabase
          .from("inspection_stock_checks")
          .insert(spotCheckRows);
        if (scError) throw scError;
      }

      // Auto-create violations if noted
      if (violationNoted && violations.length > 0) {
        const validViolations = violations.filter((v) => v.type && v.staffId);
        if (validViolations.length > 0) {
          const { error: vioError } = await supabase
            .from("staff_violations")
            .insert(
              validViolations.map((v) => ({
                staff_id: v.staffId,
                venue_id: selectedVenue,
                type: v.type,
                description: v.description || null,
                severity: v.severity,
                date: now.toISOString().split("T")[0],
                reported_by: user.id,
              }))
            );
          if (vioError) console.error("Violation insert error:", vioError);
        }
      }

      toast.success(`Inspection submitted — Score: ${scorePercent}%`);
      navigate("/inspections");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit inspection");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout title="New Inspection" subtitle="Quick club audit">
      <div className="space-y-4 max-w-2xl mx-auto pb-8">
        {/* Venue Selection */}
        <Card>
          <CardContent className="p-4">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Select Club</label>
            <Select value={selectedVenue} onValueChange={setSelectedVenue}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Choose a club..." />
              </SelectTrigger>
              <SelectContent>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Checklist — Big toggle buttons */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              Checklist
              <span className={`text-sm font-bold ${scorePercent >= 80 ? "text-success" : scorePercent >= 50 ? "text-warning" : "text-destructive"}`}>
                {score}/{totalChecks} ({scorePercent}%)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-2">
              {CHECKS.map((item) => {
                const isOn = checks[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleCheck(item.key)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left touch-manipulation ${
                      isOn
                        ? "border-success bg-success/10 shadow-sm"
                        : "border-border bg-card hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-sm font-medium flex-1 leading-tight">{item.label}</span>
                    {isOn ? (
                      <Check className="h-5 w-5 text-success shrink-0" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Stock Spot Check */}
        {selectedVenue && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Stock Spot Check (3 Random Flavours)</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
              {loadingSpotChecks ? (
                <div className="text-center py-4 text-muted-foreground text-sm">Picking random flavours...</div>
              ) : (
                spotChecks.map((sc, idx) => (
                  <div key={sc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">{sc.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <div className="text-[10px] text-muted-foreground mb-0.5">Reported</div>
                        <Input
                          type="number"
                          min={0}
                          value={sc.reported}
                          onChange={(e) => {
                            const updated = [...spotChecks];
                            updated[idx] = { ...sc, reported: e.target.value };
                            setSpotChecks(updated);
                          }}
                          className="h-10 w-16 text-center"
                          placeholder="—"
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-muted-foreground mb-0.5">Actual</div>
                        <Input
                          type="number"
                          min={0}
                          value={sc.measured}
                          onChange={(e) => {
                            const updated = [...spotChecks];
                            updated[idx] = { ...sc, measured: e.target.value };
                            setSpotChecks(updated);
                          }}
                          className="h-10 w-16 text-center"
                          placeholder="—"
                        />
                      </div>
                      {sc.reported && sc.measured && (
                        <span className={`text-xs font-bold mt-3 ${sc.reported === sc.measured ? "text-success" : "text-destructive"}`}>
                          {sc.reported === sc.measured ? "✓" : "✗"}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => pickSpotCheckFlavours(selectedVenue)}
                className="text-xs"
              >
                🔄 Re-pick Flavours
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Photo Capture */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📸 Inspection Photo</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
            />
            {photoPreview ? (
              <div className="space-y-2">
                <img src={photoPreview} alt="Inspection" className="w-full h-48 object-cover rounded-lg" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                  }}
                >
                  Retake
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-20 border-dashed"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="mr-2 h-6 w-6" />
                Take Photo
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Violation Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Violation Found?
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-3">
            <button
              type="button"
              onClick={() => setViolationNoted(!violationNoted)}
              className={`w-full p-3 rounded-xl border-2 text-center font-medium transition-all touch-manipulation ${
                violationNoted
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border bg-card"
              }`}
            >
              {violationNoted ? "⚠️ Yes — Violation Found" : "No Violations"}
            </button>

            {violationNoted && (
              <div className="space-y-3 pt-2 border-t">
                <Select value={violationStaffId} onValueChange={setViolationStaffId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Staff involved..." />
                  </SelectTrigger>
                  <SelectContent>
                    {venueStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={violationType} onValueChange={setViolationType}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Violation type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grooming">Grooming</SelectItem>
                    <SelectItem value="behavior">Behavior</SelectItem>
                    <SelectItem value="attendance">Attendance</SelectItem>
                    <SelectItem value="safety">Safety</SelectItem>
                    <SelectItem value="stock_misuse">Stock Misuse</SelectItem>
                    <SelectItem value="procedure_violation">Procedure Violation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={violationSeverity} onValueChange={setViolationSeverity}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Severity..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Describe the violation..."
                  value={violationDesc}
                  onChange={(e) => setViolationDesc(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Remarks */}
        <Card>
          <CardContent className="p-4">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Remarks (Optional)</label>
            <Textarea
              placeholder="Any observations or notes..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="min-h-[60px]"
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          className="w-full h-14 text-base font-semibold"
          onClick={handleSubmit}
          disabled={!selectedVenue || submitting}
        >
          {submitting ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Send className="mr-2 h-5 w-5" />
          )}
          Submit Inspection ({scorePercent}%)
        </Button>
      </div>
    </PageLayout>
  );
};

export default InspectionForm;
