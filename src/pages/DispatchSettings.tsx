import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Loader2, Scale } from "lucide-react";

type DispatchMode = "packet" | "weight";

const DEFAULTS = {
  dispatch_mode: "packet" as DispatchMode,
  grams_per_chillum: "25",
  discrepancy_threshold_percent: "10",
};

const SETTINGS_KEYS = Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[];

const DispatchSettings = () => {
  const [dispatchMode, setDispatchMode] = useState<DispatchMode>(DEFAULTS.dispatch_mode);
  const [gramsPerChillum, setGramsPerChillum] = useState(DEFAULTS.grams_per_chillum);
  const [thresholdPercent, setThresholdPercent] = useState(DEFAULTS.discrepancy_threshold_percent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("global_settings")
      .select("key, value")
      .in("key", SETTINGS_KEYS);

    const values = new Map((data || []).map((row) => [row.key, row.value]));

    setDispatchMode((values.get("dispatch_mode") as DispatchMode) || DEFAULTS.dispatch_mode);
    setGramsPerChillum(values.get("grams_per_chillum") || DEFAULTS.grams_per_chillum);
    setThresholdPercent(values.get("discrepancy_threshold_percent") || DEFAULTS.discrepancy_threshold_percent);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!gramsPerChillum || Number(gramsPerChillum) <= 0) {
      toast.error("Grams per chillum must be a positive number");
      return;
    }
    if (!thresholdPercent || Number(thresholdPercent) < 0) {
      toast.error("Discrepancy threshold must be zero or more");
      return;
    }

    setSaving(true);
    try {
      const rows = [
        { key: "dispatch_mode", value: dispatchMode },
        { key: "grams_per_chillum", value: gramsPerChillum },
        { key: "discrepancy_threshold_percent", value: thresholdPercent },
      ];

      for (const row of rows) {
        const { data: existing } = await supabase
          .from("global_settings")
          .select("id")
          .eq("key", row.key)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("global_settings")
            .update({ value: row.value, updated_at: new Date().toISOString() })
            .eq("key", row.key);
        } else {
          await supabase.from("global_settings").insert(row);
        }
      }

      toast.success("Dispatch settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageLayout title="Dispatch Settings" subtitle="Configure how flavour is dispatched and tracked">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Dispatch Settings" subtitle="Configure how flavour is dispatched and tracked">
      <div className="space-y-4 max-w-2xl">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Dispatch Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="dispatch-mode">How flavour is sent from HQ to venues</Label>
            <Select value={dispatchMode} onValueChange={(v) => setDispatchMode(v as DispatchMode)}>
              <SelectTrigger id="dispatch-mode" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="packet">Packets (fixed weight per packet)</SelectItem>
                <SelectItem value="weight">Direct weight (grams / kg)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Changes the dispatch form's quantity input and page labels. Stock tracking and
              discrepancy detection below always work in grams either way.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Discrepancy Detection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grams-per-chillum">Average grams of flavour per chillum/pot sold</Label>
              <Input
                id="grams-per-chillum"
                type="number"
                min={1}
                step="0.1"
                value={gramsPerChillum}
                onChange={(e) => setGramsPerChillum(e.target.value)}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Used to work out expected consumption: this value × chillums sold that day.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="threshold">Discrepancy tolerance (%)</Label>
              <Input
                id="threshold"
                type="number"
                min={0}
                step="1"
                value={thresholdPercent}
                onChange={(e) => setThresholdPercent(e.target.value)}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                A venue's actual vs. expected consumption gap under this % is ignored (spillage,
                weighing error). Above it, admins are notified immediately.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="min-w-[160px]">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
        </div>
      </div>
    </PageLayout>
  );
};

export default DispatchSettings;
