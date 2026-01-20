import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Grid3X3, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface BulkAddStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueId: string;
  existingItems: { item_name: string; category: string }[];
  onItemsAdded: () => void;
}

interface BulkRow {
  id: string;
  itemName: string;
  category: string;
  unit: string;
  error?: string;
}

const CATEGORY_OPTIONS = [
  { value: "flavour", label: "Regular Flavour", dbCategory: "flavour" as const },
  { value: "premium_flavour", label: "Premium Flavour", dbCategory: "flavour" as const },
  { value: "hookah_pots", label: "Consumables", dbCategory: "hookah_pots" as const },
  { value: "accessories", label: "Accessories", dbCategory: "accessories" as const },
];

const UNIT_OPTIONS = [
  { value: "grams", label: "grams" },
  { value: "kilograms", label: "kilograms" },
  { value: "pieces", label: "pieces" },
  { value: "packets", label: "packets" },
];

const createEmptyRow = (): BulkRow => ({
  id: crypto.randomUUID(),
  itemName: "",
  category: "",
  unit: "",
  error: undefined,
});

const BulkAddStockDialog = ({
  open,
  onOpenChange,
  venueId,
  existingItems,
  onItemsAdded,
}: BulkAddStockDialogProps) => {
  const [rows, setRows] = useState<BulkRow[]>(() => 
    Array.from({ length: 5 }, createEmptyRow)
  );
  const [saving, setSaving] = useState(false);

  const resetDialog = () => {
    setRows(Array.from({ length: 5 }, createEmptyRow));
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetDialog();
    }
    onOpenChange(newOpen);
  };

  const updateRow = (id: string, field: keyof BulkRow, value: string) => {
    setRows(prev =>
      prev.map(row =>
        row.id === id ? { ...row, [field]: value, error: undefined } : row
      )
    );
  };

  const addRow = () => {
    setRows(prev => [...prev, createEmptyRow()]);
  };

  const deleteRow = (id: string) => {
    if (rows.length <= 1) {
      toast.error("At least one row is required");
      return;
    }
    setRows(prev => prev.filter(row => row.id !== id));
  };

  const isRowEmpty = (row: BulkRow) => {
    return !row.itemName.trim() && !row.category && !row.unit;
  };

  const isRowComplete = (row: BulkRow) => {
    return row.itemName.trim() && row.category && row.unit;
  };

  const validateRows = (): boolean => {
    let hasErrors = false;
    const itemKeys = new Set<string>();
    
    const updatedRows = rows.map(row => {
      // Skip empty rows
      if (isRowEmpty(row)) {
        return { ...row, error: undefined };
      }

      // Validate required fields
      if (!row.itemName.trim()) {
        hasErrors = true;
        return { ...row, error: "Item name is required" };
      }
      if (!row.category) {
        hasErrors = true;
        return { ...row, error: "Category is required" };
      }
      if (!row.unit) {
        hasErrors = true;
        return { ...row, error: "Unit is required" };
      }

      // Check for duplicates within the grid
      const categoryConfig = CATEGORY_OPTIONS.find(c => c.value === row.category);
      const dbCategory = categoryConfig?.dbCategory || row.category;
      const key = `${row.itemName.trim().toLowerCase()}_${dbCategory}`;
      
      if (itemKeys.has(key)) {
        hasErrors = true;
        return { ...row, error: "Duplicate item in grid" };
      }
      itemKeys.add(key);

      // Check against existing items
      const existingMatch = existingItems.find(
        item => 
          item.item_name.toLowerCase() === row.itemName.trim().toLowerCase() &&
          item.category === dbCategory
      );
      if (existingMatch) {
        hasErrors = true;
        return { ...row, error: "Item already exists in stock" };
      }

      return { ...row, error: undefined };
    });

    setRows(updatedRows);
    return !hasErrors;
  };

  const handleSave = async () => {
    // Validate all rows
    if (!validateRows()) {
      toast.error("Please fix the errors before saving");
      return;
    }

    // Filter non-empty rows
    const validRows = rows.filter(row => !isRowEmpty(row) && isRowComplete(row));

    if (validRows.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    setSaving(true);
    try {
      // Prepare items for insertion
      const itemsToInsert = validRows.map(row => {
        const categoryConfig = CATEGORY_OPTIONS.find(c => c.value === row.category);
        return {
          venue_id: venueId,
          item_name: row.itemName.trim(),
          category: categoryConfig?.dbCategory || "flavour",
          unit: row.unit,
          quantity: 0,
          low_stock_threshold: 10,
        };
      });

      const { error } = await supabase
        .from("stock")
        .insert(itemsToInsert);

      if (error) throw error;

      toast.success(`${validRows.length} item${validRows.length > 1 ? 's' : ''} added successfully`);
      onItemsAdded();
      handleOpenChange(false);
    } catch (error: any) {
      console.error("Bulk add error:", error);
      toast.error(error.message || "Failed to add items");
    } finally {
      setSaving(false);
    }
  };

  const nonEmptyRowCount = rows.filter(row => !isRowEmpty(row)).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Grid3X3 className="w-5 h-5 text-primary" />
            Bulk Add Stock Items
          </DialogTitle>
          <DialogDescription>
            Add multiple items at once. Fill in the grid below.
          </DialogDescription>
        </DialogHeader>

        {/* Grid container */}
        <div className="flex-1 overflow-auto -mx-6 px-6">
          {/* Grid header - hidden on mobile, shown on larger screens */}
          <div className="hidden sm:grid grid-cols-[1fr_140px_120px_40px] gap-2 mb-2 sticky top-0 bg-background py-2 z-10">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Item Name <span className="text-destructive">*</span>
            </div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Category <span className="text-destructive">*</span>
            </div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Unit <span className="text-destructive">*</span>
            </div>
            <div />
          </div>

          {/* Grid rows - stacked on mobile, horizontal on larger screens */}
          <div className="space-y-3 sm:space-y-2 pb-4">
            {rows.map((row, index) => (
              <div key={row.id} className="space-y-2 sm:space-y-1 p-3 sm:p-0 bg-muted/30 sm:bg-transparent rounded-xl sm:rounded-none">
                {/* Mobile: Row number */}
                <div className="flex items-center justify-between sm:hidden">
                  <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteRow(row.id)}
                    disabled={saving || rows.length <= 1}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Desktop grid layout */}
                <div className="hidden sm:grid grid-cols-[1fr_140px_120px_40px] gap-2 items-center">
                  {/* Item Name */}
                  <Input
                    placeholder={`Item ${index + 1}`}
                    value={row.itemName}
                    onChange={(e) => updateRow(row.id, "itemName", e.target.value)}
                    className={cn(
                      "h-11 text-sm rounded-xl",
                      row.error && "border-destructive focus-visible:ring-destructive"
                    )}
                    disabled={saving}
                  />

                  {/* Category */}
                  <Select
                    value={row.category}
                    onValueChange={(v) => updateRow(row.id, "category", v)}
                    disabled={saving}
                  >
                    <SelectTrigger 
                      className={cn(
                        "h-11 text-sm rounded-xl",
                        row.error && !row.category && "border-destructive"
                      )}
                    >
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {CATEGORY_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value} className="text-sm">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Unit */}
                  <Select
                    value={row.unit}
                    onValueChange={(v) => updateRow(row.id, "unit", v)}
                    disabled={saving}
                  >
                    <SelectTrigger 
                      className={cn(
                        "h-11 text-sm rounded-xl",
                        row.error && !row.unit && "border-destructive"
                      )}
                    >
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {UNIT_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value} className="text-sm">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Delete button - desktop only */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteRow(row.id)}
                    disabled={saving || rows.length <= 1}
                    className="h-10 w-10 text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Mobile stacked layout */}
                <div className="flex flex-col gap-2 sm:hidden">
                  {/* Item Name */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Item Name</label>
                    <Input
                      placeholder="Enter item name"
                      value={row.itemName}
                      onChange={(e) => updateRow(row.id, "itemName", e.target.value)}
                      className={cn(
                        "h-11 text-sm rounded-xl",
                        row.error && "border-destructive focus-visible:ring-destructive"
                      )}
                      disabled={saving}
                    />
                  </div>

                  {/* Category & Unit row on mobile */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Category</label>
                      <Select
                        value={row.category}
                        onValueChange={(v) => updateRow(row.id, "category", v)}
                        disabled={saving}
                      >
                        <SelectTrigger 
                          className={cn(
                            "h-11 text-sm rounded-xl",
                            row.error && !row.category && "border-destructive"
                          )}
                        >
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          {CATEGORY_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value} className="text-sm">
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Unit</label>
                      <Select
                        value={row.unit}
                        onValueChange={(v) => updateRow(row.id, "unit", v)}
                        disabled={saving}
                      >
                        <SelectTrigger 
                          className={cn(
                            "h-11 text-sm rounded-xl",
                            row.error && !row.unit && "border-destructive"
                          )}
                        >
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          {UNIT_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value} className="text-sm">
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Row error message */}
                {row.error && (
                  <div className="flex items-center gap-1 text-xs text-destructive px-1">
                    <AlertCircle className="w-3 h-3" />
                    {row.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 pt-4 border-t border-border space-y-3">
          <Button
            variant="outline"
            onClick={addRow}
            disabled={saving}
            className="w-full h-11 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Row
          </Button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
              className="flex-1 h-12 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || nonEmptyRowCount === 0}
              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-gradient-start to-gradient-end hover:opacity-90"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                `Save ${nonEmptyRowCount > 0 ? `${nonEmptyRowCount} Item${nonEmptyRowCount > 1 ? 's' : ''}` : 'Items'}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAddStockDialog;
