import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";
import { Loader2, Send, Eye, Trash2, Info } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { DEFAULT_CHECKS, CheckItem, withCategoryFallback } from "./InspectionSettings";
import { InspectionContextHeader } from "@/components/inspection/InspectionContextHeader";
import { InspectionScoreCard } from "@/components/inspection/InspectionScoreCard";
import { InspectionChecklist } from "@/components/inspection/InspectionChecklist";
import { InspectionIssuesPanel, Issue } from "@/components/inspection/InspectionIssuesPanel";
import { InspectionSummaryDialog } from "@/components/inspection/InspectionSummaryDialog";
import { StockSpotCheckCard, SpotCheckFlavour } from "@/components/inspection/StockSpotCheckCard";
import { ViolationSection, ViolationEntry } from "@/components/inspection/ViolationSection";
import { ItemStates, ItemStatus, PreviousInspection, emptyItemState } from "@/components/inspection/types";

const DRAFT_PREFIX = "smokzy_inspection_draft_";

interface DraftPayload {
  itemStatuses: Record<string, { status: ItemStatus | null; reason: string; notes: string }>;
  remarks: string;
  violationNoted: boolean;
  violations: ViolationEntry[];
  savedAt: string;
}

const InspectionForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedVenue = searchParams.get("venue");

  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [selectedVenue, setSelectedVenue] = useState(preselectedVenue || "");
  const [CHECKS, setCHECKS] = useState<CheckItem[]>(DEFAULT_CHECKS);
  const [itemStates, setItemStates] = useState<ItemStates>({});
  const [remarks, setRemarks] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [spotChecks, setSpotChecks] = useState<SpotCheckFlavour[]>([]);
  const [loadingSpotChecks, setLoadingSpotChecks] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inspectorName, setInspectorName] = useState("");
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const [previousInspections, setPreviousInspections] = useState<PreviousInspection[]>([]);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState<DraftPayload | null>(null);
  const [draftDismissed, setDraftDismissed] = useState(false);

  const [violationNoted, setViolationNoted] = useState(false);
  const [violations, setViolations] = useState<ViolationEntry[]>([
    { staffId: "", type: "", severity: "low", description: "" },
  ]);
  const [venueStaff, setVenueStaff] = useState<{ id: string; name: string }[]>([]);

  // Live "time spent" — refreshed periodically rather than every second, precise enough for a Quick Stat
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    supabase.from("venues").select("id, name").order("name").then(({ data }) => setVenues(data || []));
    supabase.from("global_settings").select("value").eq("key", "inspection_checklist").single().then(({ data }) => {
      let checkItems = DEFAULT_CHECKS;
      if (data?.value) {
        try { checkItems = withCategoryFallback(JSON.parse(data.value)); } catch { /* fall back to defaults */ }
      }
      setCHECKS(checkItems);
      const init: ItemStates = {};
      checkItems.forEach((c) => (init[c.key] = emptyItemState()));
      setItemStates(init);
    });
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).single();
      setInspectorName(profile?.full_name || data.user.email || "");
    });
  }, []);

  useEffect(() => {
    if (!selectedVenue) return;
    setStartedAt(new Date());
    pickSpotCheckFlavours(selectedVenue);
    fetchVenueStaff(selectedVenue);
    fetchPreviousInspections(selectedVenue);
    checkForDraft(selectedVenue);
  }, [selectedVenue]);

  // Autosave (text fields only — File objects can't survive localStorage)
  useEffect(() => {
    if (!selectedVenue) return;
    const payload: DraftPayload = {
      itemStatuses: Object.fromEntries(
        Object.entries(itemStates).map(([k, v]) => [k, { status: v.status, reason: v.reason, notes: v.notes }])
      ),
      remarks,
      violationNoted,
      violations,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(`${DRAFT_PREFIX}${selectedVenue}`, JSON.stringify(payload));
    } catch { /* storage full/unavailable — non-critical */ }
  }, [itemStates, remarks, violationNoted, violations, selectedVenue]);

  const checkForDraft = (venueId: string) => {
    setDraftDismissed(false);
    try {
      const raw = localStorage.getItem(`${DRAFT_PREFIX}${venueId}`);
      if (!raw) { setDraftAvailable(null); return; }
      const parsed: DraftPayload = JSON.parse(raw);
      const savedToday = new Date(parsed.savedAt).toDateString() === new Date().toDateString();
      setDraftAvailable(savedToday ? parsed : null);
    } catch {
      setDraftAvailable(null);
    }
  };

  const resumeDraft = () => {
    if (!draftAvailable) return;
    setItemStates((prev) => {
      const next = { ...prev };
      Object.entries(draftAvailable.itemStatuses).forEach(([key, v]) => {
        if (next[key]) next[key] = { ...next[key], status: v.status, reason: v.reason, notes: v.notes };
      });
      return next;
    });
    setRemarks(draftAvailable.remarks);
    setViolationNoted(draftAvailable.violationNoted);
    setViolations(draftAvailable.violations);
    setDraftDismissed(true);
    toast.success("Draft resumed");
  };

  const dismissDraft = () => {
    if (selectedVenue) localStorage.removeItem(`${DRAFT_PREFIX}${selectedVenue}`);
    setDraftDismissed(true);
  };

  const clearDraft = (venueId: string) => {
    localStorage.removeItem(`${DRAFT_PREFIX}${venueId}`);
  };

  const fetchVenueStaff = async (venueId: string) => {
    const { data: roles } = await supabase
      .from("user_roles").select("user_id").eq("role", "employee").eq("venue_id", venueId);
    if (roles && roles.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", roles.map((r) => r.user_id));
      setVenueStaff((profiles || []).map((p) => ({ id: p.id, name: p.full_name })));
    } else {
      setVenueStaff([]);
    }
  };

  const fetchPreviousInspections = async (venueId: string) => {
    const { data: inspRows } = await supabase
      .from("inspections")
      .select("id, date, time, score")
      .eq("venue_id", venueId)
      .order("date", { ascending: false })
      .order("time", { ascending: false })
      .limit(6);

    if (!inspRows || inspRows.length === 0) {
      setPreviousInspections([]);
      return;
    }

    const ids = inspRows.map((r) => r.id);
    const { data: itemRows } = await supabase
      .from("inspection_items")
      .select("inspection_id, item_key, status")
      .in("inspection_id", ids);

    const byInspection = new Map<string, Record<string, ItemStatus>>();
    (itemRows || []).forEach((r) => {
      const m = byInspection.get(r.inspection_id) || {};
      m[r.item_key] = r.status as ItemStatus;
      byInspection.set(r.inspection_id, m);
    });

    setPreviousInspections(
      inspRows.map((r) => ({ id: r.id, date: r.date, time: r.time, score: r.score, items: byInspection.get(r.id) || {} }))
    );
  };

  const pickSpotCheckFlavours = async (venueId: string) => {
    setLoadingSpotChecks(true);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const { data: dispatches } = await supabase
      .from("packet_dispatches").select("flavour_id").eq("venue_id", venueId)
      .gte("date", twoWeeksAgo.toISOString().split("T")[0]);

    const uniqueFlavourIds = [...new Set((dispatches || []).map((d) => d.flavour_id))];

    if (uniqueFlavourIds.length === 0) {
      const { data: allFlavours } = await supabase.from("flavours").select("id, name").eq("is_active", true);
      const shuffled = (allFlavours || []).sort(() => Math.random() - 0.5);
      setSpotChecks(shuffled.slice(0, 3).map((f) => ({ id: f.id, name: f.name, reported: "", measured: "" })));
    } else {
      const { data: flavourDetails } = await supabase.from("flavours").select("id, name").in("id", uniqueFlavourIds);
      const shuffled = (flavourDetails || []).sort(() => Math.random() - 0.5);
      setSpotChecks(shuffled.slice(0, 3).map((f) => ({ id: f.id, name: f.name, reported: "", measured: "" })));
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

  const setItemStatus = useCallback((key: string, status: ItemStatus) => {
    setItemStates((prev) => ({ ...prev, [key]: { ...prev[key], status } }));
  }, []);
  const setItemReason = useCallback((key: string, reason: string) => {
    setItemStates((prev) => ({ ...prev, [key]: { ...prev[key], reason } }));
  }, []);
  const setItemNotes = useCallback((key: string, notes: string) => {
    setItemStates((prev) => ({ ...prev, [key]: { ...prev[key], notes } }));
  }, []);
  const addItemPhoto = useCallback((key: string, file: File) => {
    const preview = URL.createObjectURL(file);
    setItemStates((prev) => ({ ...prev, [key]: { ...prev[key], photos: [...prev[key].photos, { file, preview }] } }));
  }, []);
  const removeItemPhoto = useCallback((key: string, index: number) => {
    setItemStates((prev) => ({ ...prev, [key]: { ...prev[key], photos: prev[key].photos.filter((_, i) => i !== index) } }));
  }, []);

  const stats = useMemo(() => {
    const values = CHECKS.map((c) => itemStates[c.key]).filter(Boolean);
    const completed = values.filter((s) => s.status !== null).length;
    const passCount = values.filter((s) => s.status === 'pass').length;
    const attentionCount = values.filter((s) => s.status === 'attention').length;
    const failCount = values.filter((s) => s.status === 'fail').length;
    const total = CHECKS.length;
    const scorePercent = total > 0 ? Math.round((passCount / total) * 100) : 0;
    return { completed, total, passCount, attentionCount, failCount, scorePercent };
  }, [CHECKS, itemStates]);

  const repeatCounts = useMemo(() => {
    const result: Record<string, number> = {};
    Object.entries(itemStates).forEach(([key, state]) => {
      if (state.status !== 'attention' && state.status !== 'fail') return;
      let streak = 0;
      for (const insp of previousInspections) {
        const s = insp.items[key];
        if (s === 'attention' || s === 'fail') streak++;
        else break;
      }
      if (streak > 0) result[key] = streak + 1;
    });
    return result;
  }, [itemStates, previousInspections]);

  const issues: Issue[] = useMemo(() => {
    return CHECKS
      .filter((c) => itemStates[c.key]?.status === 'attention' || itemStates[c.key]?.status === 'fail')
      .map((c) => ({
        key: c.key,
        label: c.label,
        icon: c.icon,
        status: itemStates[c.key].status as 'attention' | 'fail',
        reason: itemStates[c.key].reason,
        photoCount: itemStates[c.key].photos.length,
      }));
  }, [CHECKS, itemStates]);

  const trend = previousInspections.length >= 2
    ? (previousInspections[0].score ?? 0) - (previousInspections[1].score ?? 0)
    : null;

  const totalPhotos = (photoFile ? 1 : 0) + Object.values(itemStates).reduce((sum, s) => sum + s.photos.length, 0);
  const timeSpentSeconds = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000)) : 0;
  void tick; // forces the periodic re-render that keeps timeSpentSeconds fresh

  const resetForm = () => {
    const init: ItemStates = {};
    CHECKS.forEach((c) => (init[c.key] = emptyItemState()));
    setItemStates(init);
    setRemarks("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setViolationNoted(false);
    setViolations([{ staffId: "", type: "", severity: "low", description: "" }]);
  };

  const handleDiscard = () => {
    if (selectedVenue) clearDraft(selectedVenue);
    resetForm();
    setShowDiscardConfirm(false);
    navigate("/inspections");
  };

  const handleSubmit = async () => {
    if (!selectedVenue) {
      toast.error("Please select a club");
      return;
    }
    if (stats.completed < stats.total) {
      toast.error(`Review all checklist items first (${stats.completed}/${stats.total} done)`);
      return;
    }
    setSubmitting(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");

      let photoUrl: string | null = null;
      if (photoFile) {
        const compressed = await compressImage(photoFile, { maxSizeMB: 0.5 });
        const fileName = `inspection_${selectedVenue}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from("kot-photos").upload(fileName, compressed, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("kot-photos").getPublicUrl(fileName);
        photoUrl = urlData.publicUrl;
      }

      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0];

      const { data: inspection, error: inspError } = await supabase
        .from("inspections")
        .insert({
          venue_id: selectedVenue,
          inspector_id: user.id,
          date: now.toISOString().split("T")[0],
          time: timeStr,
          remarks: remarks || null,
          photo_url: photoUrl,
          violation_noted: violationNoted,
          score: stats.scorePercent,
        })
        .select("id")
        .single();

      if (inspError) throw inspError;

      // Upload per-item evidence photos, then write the normalized item rows
      const itemRows = await Promise.all(
        CHECKS.map(async (item) => {
          const state = itemStates[item.key];
          const photoUrls: string[] = [];
          for (const p of state.photos) {
            const compressed = await compressImage(p.file, { maxSizeMB: 0.4 });
            const fileName = `inspection_item_${inspection.id}_${item.key}_${Date.now()}_${photoUrls.length}.jpg`;
            const { error: upErr } = await supabase.storage.from("kot-photos").upload(fileName, compressed, { contentType: "image/jpeg" });
            if (!upErr) {
              const { data: urlData } = supabase.storage.from("kot-photos").getPublicUrl(fileName);
              photoUrls.push(urlData.publicUrl);
            }
          }
          return {
            inspection_id: inspection.id,
            item_key: item.key,
            item_label: item.label,
            category: item.category,
            status: state.status || 'pass',
            reason: state.reason || null,
            notes: state.notes || null,
            photo_urls: photoUrls,
          };
        })
      );

      const { error: itemsError } = await supabase.from("inspection_items").insert(itemRows);
      if (itemsError) throw itemsError;

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
        const { error: scError } = await supabase.from("inspection_stock_checks").insert(spotCheckRows);
        if (scError) throw scError;
      }

      if (violationNoted && violations.length > 0) {
        const validViolations = violations.filter((v) => v.type && v.staffId);
        if (validViolations.length > 0) {
          const { error: vioError } = await supabase.from("staff_violations").insert(
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

      clearDraft(selectedVenue);
      setShowSummary(false);
      toast.success(`Inspection submitted — Score: ${stats.scorePercent}%`);
      navigate("/inspections");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit inspection");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedVenueName = venues.find((v) => v.id === selectedVenue)?.name || "";
  const canComplete = !!selectedVenue && stats.completed === stats.total && !submitting;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-6xl mx-auto p-3 space-y-4">
        <InspectionContextHeader
          venues={venues}
          selectedVenue={selectedVenue}
          onVenueChange={setSelectedVenue}
          lastInspection={previousInspections[0] || null}
          trend={trend}
          inspectorName={inspectorName}
          startedAt={startedAt}
          onBack={() => navigate("/inspections")}
        />

        {draftAvailable && !draftDismissed && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 text-xs text-foreground">
              <Info className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>Unsaved draft from {new Date(draftAvailable.savedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} found for this club.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={dismissDraft}>Discard</Button>
              <Button size="sm" className="h-7 text-xs" onClick={resumeDraft}>Resume</Button>
            </div>
          </div>
        )}

        {!selectedVenue ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground text-sm">
            Select a club above to begin the inspection.
          </div>
        ) : (
          <>
            <InspectionScoreCard
              scorePercent={stats.scorePercent}
              completed={stats.completed}
              total={stats.total}
              passCount={stats.passCount}
              attentionCount={stats.attentionCount}
              failCount={stats.failCount}
            />

            <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
              <div className="space-y-4 order-2 lg:order-1">
                <InspectionChecklist
                  items={CHECKS}
                  itemStates={itemStates}
                  onStatusChange={setItemStatus}
                  onReasonChange={setItemReason}
                  onNotesChange={setItemNotes}
                  onAddPhoto={addItemPhoto}
                  onRemovePhoto={removeItemPhoto}
                  repeatCounts={repeatCounts}
                  focusedKey={focusedKey}
                />

                <StockSpotCheckCard
                  spotChecks={spotChecks}
                  loading={loadingSpotChecks}
                  onChange={(idx, field, value) => {
                    const updated = [...spotChecks];
                    updated[idx] = { ...updated[idx], [field]: value };
                    setSpotChecks(updated);
                  }}
                  onRepick={() => pickSpotCheckFlavours(selectedVenue)}
                />

                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-4 py-2.5 border-b bg-muted/30">
                    <span className="text-sm font-semibold">Inspection Photo</span>
                  </div>
                  <div className="p-3">
                    <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" id="general-photo-input" />
                    {photoPreview ? (
                      <div className="space-y-2">
                        <img src={photoPreview} alt="Inspection" className="w-full h-48 object-cover rounded-lg" />
                        <Button variant="outline" size="sm" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}>
                          Retake
                        </Button>
                      </div>
                    ) : (
                      <label htmlFor="general-photo-input">
                        <Button variant="outline" className="w-full h-16 border-dashed" asChild>
                          <span>Take Photo</span>
                        </Button>
                      </label>
                    )}
                  </div>
                </div>

                <ViolationSection
                  violationNoted={violationNoted}
                  onToggle={() => setViolationNoted(!violationNoted)}
                  violations={violations}
                  venueStaff={venueStaff}
                  onAdd={() => setViolations((prev) => [...prev, { staffId: "", type: "", severity: "low", description: "" }])}
                  onUpdate={(idx, field, value) => setViolations((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)))}
                  onRemove={(idx) => {
                    setViolations((prev) => prev.filter((_, i) => i !== idx));
                    if (violations.length <= 1) setViolationNoted(false);
                  }}
                />

                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-4 py-2.5 border-b bg-muted/30">
                    <span className="text-sm font-semibold">Manager Notes (Optional)</span>
                  </div>
                  <div className="p-3">
                    <Textarea
                      placeholder="Overall club condition, service quality, anything else worth noting..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value.slice(0, 500))}
                      className="min-h-[80px]"
                      maxLength={500}
                    />
                    <p className="text-[10px] text-muted-foreground text-right mt-1">{remarks.length} / 500</p>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2">
                <InspectionIssuesPanel
                  issues={issues}
                  onSelectIssue={setFocusedKey}
                  quickStats={{
                    photosAdded: totalPhotos,
                    checksCompleted: stats.completed,
                    totalChecks: stats.total,
                    timeSpentSeconds,
                    criticalCount: stats.failCount,
                    repeatIssuesCount: Object.keys(repeatCounts).length,
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t p-3">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setShowDiscardConfirm(true)} disabled={!selectedVenue}>
            <Trash2 className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Discard</span>
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setShowSummary(true)} disabled={!selectedVenue}>
            <Eye className="h-4 w-4 mr-1.5" />
            Preview Summary
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={!canComplete}>
            {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
            Complete ({stats.completed}/{stats.total})
          </Button>
        </div>
      </div>

      <InspectionSummaryDialog
        open={showSummary}
        onOpenChange={setShowSummary}
        clubName={selectedVenueName}
        date={new Date()}
        scorePercent={stats.scorePercent}
        completed={stats.completed}
        total={stats.total}
        passCount={stats.passCount}
        attentionCount={stats.attentionCount}
        failCount={stats.failCount}
        criticalIssues={issues.filter((i) => i.status === 'fail')}
        photosCount={totalPhotos}
        notes={remarks}
        submitting={submitting}
        onConfirm={handleSubmit}
      />

      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this inspection?</AlertDialogTitle>
            <AlertDialogDescription>
              Nothing has been saved yet — all checklist states, photos, and notes for this inspection will be cleared. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InspectionForm;
