import { useState, useEffect, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Package, Loader2, Plus, Search } from "lucide-react";
import { ClubSession } from "@/hooks/useClubSession";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const StockModule = ({ user, venueId, session, updateSessionTask }: StockModuleProps) => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitterName, setSubmitterName] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  
  // Add item state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<StockCategory | "">("");
  const [addingItem, setAddingItem] = useState(false);

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

  const handleQuantityChange = (itemId: string, value: string) => {
    // Allow empty string for clearing, otherwise only allow numbers
    if (value === '' || /^\d+$/.test(value)) {
      setQuantities(prev => ({
        ...prev,
        [itemId]: value,
      }));
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

      // Add to local state with pending flag
      const newItem: StockItem = {
        ...data,
        isPending: true,
      };
      
      setStock(prev => [...prev, newItem]);
      setQuantities(prev => ({ ...prev, [data.id]: '0' }));
      
      setNewItemName("");
      setNewItemCategory("");
      setAddDialogOpen(false);
      toast.success("Item added. Enter the current stock quantity.");
    } catch (error: any) {
      console.error("Add item error:", error);
      toast.error(error.message || "Failed to add item");
    } finally {
      setAddingItem(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Validate all quantities are entered
      const hasEmpty = stock.some(item => quantities[item.id] === '' || quantities[item.id] === undefined);
      if (hasEmpty) {
        toast.error("Please enter quantities for all items");
        setSubmitting(false);
        return;
      }

      // Update all stock items
      for (const [itemId, qty] of Object.entries(quantities)) {
        const { error } = await supabase
          .from("stock")
          .update({ quantity: parseInt(qty) || 0 })
          .eq("id", itemId);

        if (error) throw error;
      }

      // Update session
      await updateSessionTask('stock', user.id);
      
      toast.success("Stock locked for today. Good control! ✓");
    } catch (error: any) {
      console.error("Stock update error:", error);
      toast.error(error.message || "Failed to update stock");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter items by search
  const filteredItems = stock.filter(item =>
    item.item_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by category
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gradient-start to-gradient-end flex items-center justify-center mb-6">
          <Check className="w-12 h-12 text-white" />
        </div>
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
      </div>
    );
  }

  if (stock.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-8">
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
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full pb-32">
      {/* Header with search and add */}
      <div className="px-5 pt-4 pb-3 space-y-4">
        <div className="flex items-center gap-3">
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
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                size="icon" 
                className="h-14 w-14 rounded-2xl bg-gradient-to-r from-gradient-start to-gradient-end hover:opacity-90 shrink-0"
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
        </div>
        
        <p className="text-sm text-muted-foreground">
          Enter current quantities. Changes save automatically.
        </p>
      </div>

      {/* Stock items by category */}
      <div className="flex-1 overflow-auto px-5 pb-4">
        <div className="space-y-8">
          {groupedItems.map(group => (
            <div key={group.category} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-4 px-5 bg-card rounded-2xl"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate">{item.item_name}</p>
                        {item.isPending && (
                          <span className="text-xs px-2 py-0.5 bg-warning/10 text-warning rounded-full shrink-0">
                            New
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Quantity input with unit */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={quantities[item.id] ?? ''}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        className="w-24 h-14 text-center text-xl font-semibold rounded-xl bg-muted/50 border-0"
                        placeholder="0"
                      />
                      <span className="text-sm text-muted-foreground w-12">
                        {item.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit button - fixed at bottom */}
      <div className="fixed bottom-20 left-0 right-0 px-5 py-4 bg-gradient-to-t from-background via-background to-transparent">
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
      </div>
    </div>
  );
};

export default StockModule;