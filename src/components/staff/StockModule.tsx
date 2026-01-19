import { useState, useEffect, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, Minus, Plus, Check, Package, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { ClubSession } from "@/hooks/useClubSession";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
}

interface CategoryGroup {
  category: string;
  label: string;
  items: StockItem[];
  isOpen: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  flavour: 'Regular Flavors',
  hookah_pots: 'Hookah Pots',
  accessories: 'Accessories',
};

const StockModule = ({ user, venueId, session, updateSessionTask }: StockModuleProps) => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    flavour: true,
    hookah_pots: true,
    accessories: true,
  });
  const [submitterName, setSubmitterName] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

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
      // Initialize quantities with current values
      const initialQuantities: Record<string, number> = {};
      data.forEach(item => {
        initialQuantities[item.id] = item.quantity;
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

  const handleQuantityChange = (itemId: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) + delta),
    }));
  };

  const handleDirectInput = (itemId: string, value: string) => {
    const num = parseInt(value) || 0;
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, num),
    }));
  };

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Update all stock items
      for (const [itemId, qty] of Object.entries(quantities)) {
        const { error } = await supabase
          .from("stock")
          .update({ quantity: qty })
          .eq("id", itemId);

        if (error) throw error;
      }

      // Update session
      await updateSessionTask('stock', user.id);
      
      toast.success("Stock updated. Good job keeping things in control! ✓");
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
  const groupedItems: CategoryGroup[] = ['flavour', 'hookah_pots', 'accessories']
    .map(category => ({
      category,
      label: CATEGORY_LABELS[category],
      items: filteredItems.filter(item => item.category === category),
      isOpen: openCategories[category],
    }))
    .filter(group => group.items.length > 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="mt-2 text-muted-foreground">Loading stock...</p>
      </div>
    );
  }

  // Already submitted state
  if (session?.stock_submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 space-y-6">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
          <Check className="w-10 h-10 text-success" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Stock Submitted</h2>
          {submitterName && submittedAt && (
            <p className="text-muted-foreground">
              By {submitterName} at {submittedAt}
            </p>
          )}
        </div>
        <div className="bg-success/5 border border-success/20 rounded-2xl p-4 text-center max-w-xs">
          <p className="text-sm text-success font-medium">
            Good job keeping things in control!
          </p>
        </div>
      </div>
    );
  }

  if (stock.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 space-y-4">
        <Package className="w-16 h-16 text-muted-foreground/50" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">No Stock Items</h2>
          <p className="text-muted-foreground text-sm">
            Ask your admin to set up stock items for this venue
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] pb-20">
      {/* Search bar */}
      <div className="sticky top-0 z-10 bg-background p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-base rounded-xl bg-muted/50"
          />
        </div>
      </div>

      {/* Stock items by category */}
      <div className="flex-1 px-4 py-4 space-y-3">
        {groupedItems.map(group => (
          <Collapsible
            key={group.category}
            open={group.isOpen}
            onOpenChange={() => toggleCategory(group.category)}
          >
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-xl hover:bg-muted transition-colors">
                <span className="font-semibold text-foreground">{group.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{group.items.length} items</span>
                  {group.isOpen ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {group.items.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-card border border-border rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{item.item_name}</p>
                    <p className="text-xs text-muted-foreground">{item.unit}</p>
                  </div>
                  
                  {/* Counter */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-xl shrink-0"
                      onClick={() => handleQuantityChange(item.id, -1)}
                    >
                      <Minus className="w-5 h-5" />
                    </Button>
                    <Input
                      type="number"
                      min="0"
                      value={quantities[item.id] || 0}
                      onChange={(e) => handleDirectInput(item.id, e.target.value)}
                      className="w-16 h-12 text-center text-lg font-semibold rounded-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-xl shrink-0"
                      onClick={() => handleQuantityChange(item.id, 1)}
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      {/* Submit button - fixed at bottom */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-background border-t border-border">
        <Button
          onClick={handleSubmit}
          disabled={submitting || stock.length === 0}
          className="w-full h-14 text-lg font-semibold rounded-2xl bg-primary hover:bg-primary/90"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Check className="w-5 h-5 mr-2" />
              Submit Stock Count
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default StockModule;
