import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Save, Loader2 } from "lucide-react";

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

const EMOJI_OPTIONS = ["👔", "🧹", "💨", "🎵", "📦", "🛡️", "⭐", "🤝", "💳", "🔓", "🔒", "🔧", "🍽️", "🚿", "📋", "🎯", "🔥", "💡", "🧊", "🪑"];

const InspectionSettings = () => {
  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchChecklist();
  }, []);

  const fetchChecklist = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", "inspection_checklist")
      .single();

    if (data?.value) {
      try {
        setItems(JSON.parse(data.value));
      } catch {
        setItems(DEFAULT_CHECKS);
      }
    } else {
      setItems(DEFAULT_CHECKS);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert into global_settings
      const { data: existing } = await supabase
        .from("global_settings")
        .select("id")
        .eq("key", "inspection_checklist")
        .single();

      if (existing) {
        await supabase
          .from("global_settings")
          .update({ value: JSON.stringify(items), updated_at: new Date().toISOString() })
          .eq("key", "inspection_checklist");
      } else {
        await supabase
          .from("global_settings")
          .insert({ key: "inspection_checklist", value: JSON.stringify(items) });
      }

      toast.success("Inspection checklist saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    const key = `custom_${Date.now()}`;
    setItems([...items, { key, label: "", icon: "📋" }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof CheckItem, value: string) => {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= items.length) return;
    const newItems = [...items];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    setItems(newItems);
  };

  if (loading) {
    return (
      <PageLayout title="Inspection Checklist" subtitle="Manage inspection check items">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Inspection Checklist" subtitle="Add, remove, or reorder inspection check items">
      <div className="space-y-4 max-w-2xl">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Checklist Items ({items.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((item, index) => (
              <div key={item.key} className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                {/* Reorder */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs"
                  >▲</button>
                  <button
                    onClick={() => moveItem(index, 1)}
                    disabled={index === items.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs"
                  >▼</button>
                </div>

                {/* Emoji picker */}
                <select
                  value={item.icon}
                  onChange={e => updateItem(index, "icon", e.target.value)}
                  className="w-12 h-9 text-center text-lg bg-transparent border rounded cursor-pointer"
                >
                  {EMOJI_OPTIONS.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>

                {/* Label */}
                <Input
                  value={item.label}
                  onChange={e => updateItem(index, "label", e.target.value)}
                  placeholder="Check item label..."
                  className="flex-1 h-9"
                />

                {/* Delete */}
                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive shrink-0" onClick={() => removeItem(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No checklist items. Click "Add Item" to create one.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Changes take effect on the next inspection form submission.
          </p>
          <Button onClick={handleSave} disabled={saving} className="min-w-[160px]">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Checklist
          </Button>
        </div>
      </div>
    </PageLayout>
  );
};

export default InspectionSettings;
