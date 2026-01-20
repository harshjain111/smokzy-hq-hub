import { useState, useEffect, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Package, Loader2, Plus, Search, ChevronDown, ChevronUp, Pencil, Trash2, MoreVertical, Grid3X3 } from "lucide-react";
import { ClubSession } from "@/hooks/useClubSession";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import BulkAddStockDialog from "./BulkAddStockDialog";

interface StockModuleProps {
  user: User;
  venueId: string;
  session: ClubSession | null;
  updateSessionTask: (task: 'stock' | 'sales' | 'photo', submittedBy: string) => Promise<void>;
}

interface StockItem {
  id: string;
  item_name: string;
  category: 'flavour' | 'hookah_pots' | 'accessories';
  quantity: number;
  unit: string;
  isPending?: boolean;
}

type StockCategory = 'flavour' | 'premium_flavour' | 'hookah_pots' | 'accessories';

const CATEGORY_CONFIG: Record<StockCategory, { label: string; unit: string; dbCategory: 'flavour' | 'hookah_pots' | 'accessories' }> = {
  flavour: { label: 'Regular Flavour', unit: 'grams', dbCategory: 'flavour' },
  premium_flavour: { label: 'Premium Flavour', unit: 'grams', dbCategory: 'flavour' },
  hookah_pots: { label: 'Hookah Pot', unit: 'pcs', dbCategory: 'hookah_pots' },
  accessories: { label: 'Accessory', unit: 'pcs', dbCategory: 'accessories' },
};

const CATEGORY_DISPLAY: Record<string, string> = {
  flavour: 'Flavours',
  hookah_pots: 'Hookah Pots',
  accessories: 'Accessories',
};

const UNIT_OPTIONS = ['grams', 'pcs', 'kg', 'ml', 'liters', 'boxes', 'packs'];

const StockModule = ({ user, venueId, session, updateSessionTask }: StockModuleProps) => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitterName, setSubmitterName] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  
  // Collapsed categories state
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  
  // Add item state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkAddDialogOpen, setBulkAddDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<StockCategory | "">("");
  const [addingItem, setAddingItem] = useState(false);
  
  // Edit item state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Delete item state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<StockItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("stock")
      .select("id, item_name, category, quantity, unit")
      .eq("venue_id", venueId)
      .order("category")
      .order("item_name");

    if (data) {
      setStock(data);
      const initialQuantities: Record<string, string> = {};
      data.forEach(item => {
        initialQuantities[item.id] = item.quantity.toString();
      });
      setQuantities(initialQuantities);
    }
    setLoading(false);
  }, [venueId]);

  const fetchSubmitterInfo = useCallback(async () => {
    if (!session?.stock_submitted_by || !session?.stock_submitted_at) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.stock_submitted_by)
      .single();

    if (profile) {
      setSubmitterName(profile.full_name);
      setSubmittedAt(new Date(session.stock_submitted_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }));
    }
  }, [session]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  useEffect(() => {
    if (session?.stock_submitted) {
      fetchSubmitterInfo();
    }
  }, [session, fetchSubmitterInfo]);

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setQuantities(prev => ({
        ...prev,
        [itemId]: value,
      }));
      // Clear validation error when user enters a value
      if (value !== '') {
        setValidationErrors(prev => ({ ...prev, [itemId]: false }));
      }
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim() || !newItemCategory) {
      toast.error("Please fill in all fields");
      return;
    }

    setAddingItem(true);
    try {
      const config = CATEGORY_CONFIG[newItemCategory];
      const { data, error } = await supabase
        .from("stock")
        .insert({
          venue_id: venueId,
          item_name: newItemName.trim(),
          category: config.dbCategory,
          unit: config.unit,
          quantity: 0,
          low_stock_threshold: 10,
        })
        .select()
        .single();

      if (error) throw error;

      const newItem: StockItem = {
        ...data,
        isPending: true,
      };
      
      setStock(prev => [...prev, newItem]);
      setQuantities(prev => ({ ...prev, [data.id]: '0' }));
      
      setNewItemName("");
      setNewItemCategory("");
      setAddDialogOpen(false);
      toast.success("Item added successfully");
    } catch (error: any) {
      console.error("Add item error:", error);
      toast.error(error.message || "Failed to add item");
    } finally {
      setAddingItem(false);
    }
  };

  const openEditDialog = (item: StockItem) => {
    setEditingItem(item);
    setEditName(item.item_name);
    setEditUnit(item.unit);
    setEditDialogOpen(true);
  };

  const handleEditItem = async () => {
    if (!editingItem || !editName.trim() || !editUnit) {
      toast.error("Please fill in all fields");
      return;
    }

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("stock")
        .update({
          item_name: editName.trim(),
          unit: editUnit,
        })
        .eq("id", editingItem.id);

      if (error) throw error;

      setStock(prev => prev.map(item => 
        item.id === editingItem.id 
          ? { ...item, item_name: editName.trim(), unit: editUnit }
          : item
      ));
      
      setEditDialogOpen(false);
      setEditingItem(null);
      toast.success("Item updated successfully");
    } catch (error: any) {
      console.error("Edit item error:", error);
      toast.error(error.message || "Failed to update item");
    } finally {
      setSavingEdit(false);
    }
  };

  const openDeleteDialog = (item: StockItem) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!deletingItem) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("stock")
        .delete()
        .eq("id", deletingItem.id);

      if (error) throw error;

      setStock(prev => prev.filter(item => item.id !== deletingItem.id));
      const newQuantities = { ...quantities };
      delete newQuantities[deletingItem.id];
      setQuantities(newQuantities);
      
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      toast.success("Item deleted successfully");
    } catch (error: any) {
      console.error("Delete item error:", error);
      toast.error(error.message || "Failed to delete item");
    } finally {
      setDeleting(false);
    }
  };

  // Track which items have validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  const handleSubmit = async () => {
    // Validate ALL items have explicit input (not empty string or undefined)
    const emptyItems: Record<string, boolean> = {};
    let hasEmpty = false;
    
    for (const item of stock) {
      const qty = quantities[item.id];
      if (qty === '' || qty === undefined) {
        emptyItems[item.id] = true;
        hasEmpty = true;
      }
    }
    
    if (hasEmpty) {
      setValidationErrors(emptyItems);
      toast.error("Please enter stock quantity for all items before submitting.");
      return;
    }
    
    // Clear validation errors
    setValidationErrors({});
    setSubmitting(true);
    
    try {
      for (const [itemId, qty] of Object.entries(quantities)) {
        // Only parse if qty is a valid string number (already validated non-empty above)
        const quantity = parseInt(qty);
        
        const { error } = await supabase
          .from("stock")
          .update({ quantity })
          .eq("id", itemId);

        if (error) throw error;
      }

      await updateSessionTask('stock', user.id);
      
      toast.success("Stock locked for today. Good control! ✓");
    } catch (error: any) {
      console.error("Stock update error:", error);
      toast.error(error.message || "Failed to update stock");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = stock.filter(item =>
    item.item_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedItems = ['flavour', 'hookah_pots', 'accessories']
    .map(category => ({
      category,
      label: CATEGORY_DISPLAY[category],
      items: filteredItems.filter(item => item.category === category),
    }))
    .filter(group => group.items.length > 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="mt-3 text-muted-foreground">Loading stock...</p>
      </div>
    );
  }

  // Already submitted state
  if (session?.stock_submitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[60vh] px-8"
      >
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-gradient-start to-gradient-end flex items-center justify-center mb-6"
        >
          <Check className="w-12 h-12 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Stock Submitted</h2>
        {submitterName && submittedAt && (
          <p className="text-muted-foreground mb-6">
            By {submitterName} at {submittedAt}
          </p>
        )}
        <div className="bg-success/10 rounded-2xl px-6 py-4 text-center">
          <p className="text-success font-medium">
            Stock locked for today. Good control.
          </p>
        </div>
      </motion.div>
    );
  }

  if (stock.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[60vh] px-8"
      >
        <Package className="w-16 h-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">No Stock Items</h2>
        <p className="text-muted-foreground text-sm text-center mb-6">
          Start by adding items to track
        </p>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-14 px-8 rounded-2xl text-base font-semibold bg-gradient-to-r from-gradient-start to-gradient-end hover:opacity-90 transition-opacity">
              <Plus className="w-5 h-5 mr-2" />
              Add First Item
            </Button>
          </DialogTrigger>
          <DialogContent className="mx-4 rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Add Stock Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label htmlFor="itemName" className="text-sm font-medium">Item Name</Label>
                <Input
                  id="itemName"
                  placeholder="e.g., Mint, Blueberry Mix"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="h-14 text-base rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                <Select value={newItemCategory} onValueChange={(v) => setNewItemCategory(v as StockCategory)}>
                  <SelectTrigger className="h-14 text-base rounded-xl">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key} className="h-12">
                        {config.label} ({config.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAddItem}
                disabled={addingItem || !newItemName.trim() || !newItemCategory}
                className="w-full h-14 text-base font-semibold rounded-2xl bg-gradient-to-r from-gradient-start to-gradient-end hover:opacity-90"
              >
                {addingItem ? <Loader2 className="w-5 h-5 animate-spin" /> : "Add Item"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-full pb-32">
      {/* Header with search and add */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 pt-4 pb-3 space-y-4"
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-base rounded-2xl bg-muted/50 border-0"
            />
          </div>
          
          {/* Single Add Button */}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                size="icon" 
                className="h-14 w-14 rounded-2xl bg-gradient-to-r from-gradient-start to-gradient-end hover:opacity-90 shrink-0"
                title="Add Item"
              >
                <Plus className="w-6 h-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="mx-4 rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-xl">Add Stock Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="itemName2" className="text-sm font-medium">Item Name</Label>
                  <Input
                    id="itemName2"
                    placeholder="e.g., Mint, Blueberry Mix"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="h-14 text-base rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category2" className="text-sm font-medium">Category</Label>
                  <Select value={newItemCategory} onValueChange={(v) => setNewItemCategory(v as StockCategory)}>
                    <SelectTrigger className="h-14 text-base rounded-xl">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key} className="h-12">
                          {config.label} ({config.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAddItem}
                  disabled={addingItem || !newItemName.trim() || !newItemCategory}
                  className="w-full h-14 text-base font-semibold rounded-2xl bg-gradient-to-r from-gradient-start to-gradient-end hover:opacity-90"
                >
                  {addingItem ? <Loader2 className="w-5 h-5 animate-spin" /> : "Add Item"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Bulk Add Button */}
          <Button 
            size="icon"
            variant="outline"
            onClick={() => setBulkAddDialogOpen(true)}
            className="h-14 w-14 rounded-2xl border-border/50 hover:bg-muted shrink-0"
            title="Bulk Add (Grid)"
          >
            <Grid3X3 className="w-5 h-5" />
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Enter current quantities. Tap category to collapse.
        </p>
      </motion.div>

      {/* Stock items by category */}
      <div className="flex-1 overflow-auto px-5 pb-4">
        <div className="space-y-6">
          {groupedItems.map((group, groupIndex) => (
            <motion.div 
              key={group.category} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: groupIndex * 0.1 }}
              className="space-y-3"
            >
              {/* Collapsible category header */}
              <button
                onClick={() => toggleCategory(group.category)}
                className="flex items-center justify-between w-full px-1 py-2 group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-gradient-to-b from-gradient-start to-gradient-end rounded-full" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </h3>
                  <span className="text-xs text-muted-foreground/60">
                    ({group.items.length})
                  </span>
                </div>
                <motion.div
                  animate={{ rotate: collapsedCategories[group.category] ? 0 : 180 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronUp className="w-5 h-5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                </motion.div>
              </button>
              
              {/* Items list with animation */}
              <AnimatePresence>
                {!collapsedCategories[group.category] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2">
                      {group.items.map((item, itemIndex) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: itemIndex * 0.03 }}
                          className={`flex items-center justify-between py-4 px-5 bg-card rounded-2xl border shadow-sm transition-colors ${
                            validationErrors[item.id] 
                              ? 'border-destructive bg-destructive/5' 
                              : 'border-border/50'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground truncate">{item.item_name}</p>
                              {item.isPending && (
                                <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-gradient-start/20 to-gradient-end/20 text-primary rounded-full shrink-0 font-medium">
                                  New
                                </span>
                              )}
                            </div>
                            {validationErrors[item.id] && (
                              <p className="text-xs text-destructive mt-0.5">Required</p>
                            )}
                          </div>
                          
                          {/* Quantity input with unit */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={quantities[item.id] ?? ''}
                              onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                              className={`w-20 h-12 text-center text-lg font-semibold rounded-xl bg-muted/50 border focus:border-primary/50 focus:ring-primary/20 ${
                                validationErrors[item.id] ? 'border-destructive' : 'border-border/50'
                              }`}
                              placeholder="—"
                            />
                            <span className="text-xs text-muted-foreground w-10 text-center">
                              {item.unit}
                            </span>
                            
                            {/* Actions dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl">
                                <DropdownMenuItem 
                                  onClick={() => openEditDialog(item)}
                                  className="gap-2 py-3"
                                >
                                  <Pencil className="w-4 h-4" />
                                  Edit Item
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => openDeleteDialog(item)}
                                  className="gap-2 py-3 text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Item
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Submit button - fixed at bottom */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="fixed bottom-20 left-0 right-0 px-5 py-4 bg-gradient-to-t from-background via-background to-transparent"
      >
        <Button
          onClick={handleSubmit}
          disabled={submitting || stock.length === 0}
          className="w-full h-14 text-lg font-semibold rounded-2xl bg-gradient-to-r from-gradient-start to-gradient-end hover:opacity-90 transition-opacity shadow-lg"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Final Stock"
          )}
        </Button>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="mx-4 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit Item</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update the item name or unit of measurement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="editName" className="text-sm font-medium">Item Name</Label>
              <Input
                id="editName"
                placeholder="e.g., Mint, Blueberry Mix"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-14 text-base rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editUnit" className="text-sm font-medium">Unit</Label>
              <Select value={editUnit} onValueChange={setEditUnit}>
                <SelectTrigger className="h-14 text-base rounded-xl">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map(unit => (
                    <SelectItem key={unit} value={unit} className="h-12">
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleEditItem}
              disabled={savingEdit || !editName.trim() || !editUnit}
              className="w-full h-14 text-base font-semibold rounded-2xl bg-gradient-to-r from-gradient-start to-gradient-end hover:opacity-90"
            >
              {savingEdit ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingItem?.item_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="h-12 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              disabled={deleting}
              className="h-12 rounded-xl bg-destructive hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Add Dialog */}
      <BulkAddStockDialog
        open={bulkAddDialogOpen}
        onOpenChange={setBulkAddDialogOpen}
        venueId={venueId}
        existingItems={stock.map(s => ({ item_name: s.item_name, category: s.category }))}
        onItemsAdded={fetchStock}
      />
    </div>
  );
};

export default StockModule;