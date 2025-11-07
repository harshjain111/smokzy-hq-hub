import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Package, Plus, AlertTriangle } from "lucide-react";

interface StockWidgetProps {
  venueId: string;
}

interface StockItem {
  id: string;
  item_name: string;
  category: 'flavour' | 'hookah_pots' | 'accessories';
  quantity: number;
  low_stock_threshold: number;
  unit: string;
}

const StockWidget = ({ venueId }: StockWidgetProps) => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [updateStockOpen, setUpdateStockOpen] = useState(false);
  const [breakageOpen, setBreakageOpen] = useState(false);
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState<'flavour' | 'hookah_pots' | 'accessories'>('flavour');
  const [unit, setUnit] = useState("kg");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [updateQuantity, setUpdateQuantity] = useState("");
  const [breakageItem, setBreakageItem] = useState("");
  const [breakageQuantity, setBreakageQuantity] = useState("");
  const [breakageCause, setBreakageCause] = useState("");

  useEffect(() => {
    fetchStock();
  }, [venueId]);

  const fetchStock = async () => {
    const { data } = await supabase
      .from("stock")
      .select("*")
      .eq("venue_id", venueId)
      .order("category")
      .order("item_name");

    setStock(data || []);
  };

  const handleAddStockItem = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("stock").insert({
      venue_id: venueId,
      item_name: itemName,
      category: category,
      quantity: 0,
      unit: unit,
    });

    if (error) {
      toast.error("Failed to add stock item");
      console.error(error);
    } else {
      toast.success("Stock item registered successfully");
      setItemName("");
      setCategory('flavour');
      setUnit("kg");
      setAddItemOpen(false);
      fetchStock();
    }
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItemId) {
      toast.error("Please select an item");
      return;
    }

    const selectedItem = stock.find(item => item.id === selectedItemId);
    if (!selectedItem) return;

    const { error } = await supabase
      .from("stock")
      .update({
        quantity: selectedItem.quantity + parseInt(updateQuantity),
      })
      .eq("id", selectedItemId);

    if (error) {
      toast.error("Failed to update stock quantity");
      console.error(error);
    } else {
      toast.success("Stock quantity updated successfully");
      setSelectedItemId("");
      setUpdateQuantity("");
      setUpdateStockOpen(false);
      fetchStock();
    }
  };

  const handleReportBreakage = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("breakage_reports").insert({
      venue_id: venueId,
      reported_by: user.id,
      item_type: breakageItem,
      quantity: parseInt(breakageQuantity),
      cause: breakageCause,
    });

    if (error) {
      toast.error("Failed to report breakage");
    } else {
      toast.success("Breakage reported successfully");
      setBreakageItem("");
      setBreakageQuantity("");
      setBreakageCause("");
      setBreakageOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
          <DialogTrigger asChild>
            <Button className="flex-1">
              <Plus className="mr-2 h-4 w-4" />
              Register New Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register Stock Item</DialogTitle>
              <DialogDescription>Add a new item to track in your inventory</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddStockItem} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => {
                    const newCategory = e.target.value as 'flavour' | 'hookah_pots' | 'accessories';
                    setCategory(newCategory);
                    if (newCategory === 'flavour') {
                      setUnit('kg');
                    } else {
                      setUnit('pieces');
                    }
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="flavour">Flavour</option>
                  <option value="hookah_pots">Hookah Pots</option>
                  <option value="accessories">Accessories</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="itemName">Item Name</Label>
                <Input
                  id="itemName"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder={category === 'flavour' ? 'e.g., Mint, Double Apple' : 'e.g., Glass, Hose'}
                  required
                />
              </div>
              {category === 'flavour' && (
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <select
                    id="unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="grams">Grams (g)</option>
                  </select>
                </div>
              )}
              <Button type="submit" className="w-full">Register Item</Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={updateStockOpen} onOpenChange={setUpdateStockOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex-1">
              <Package className="mr-2 h-4 w-4" />
              Update Stock
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Stock Quantity</DialogTitle>
              <DialogDescription>Add stock quantity for an existing item</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateStock} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="selectItem">Select Item</Label>
                <select
                  id="selectItem"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="">Choose an item...</option>
                  {stock.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.item_name} ({item.category.replace('_', ' ')}) - Current: {item.quantity} {item.unit}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="updateQuantity">Quantity to Add</Label>
                <Input
                  id="updateQuantity"
                  type="number"
                  min="0"
                  value={updateQuantity}
                  onChange={(e) => setUpdateQuantity(e.target.value)}
                  placeholder="Enter quantity to add"
                  required
                />
                {selectedItemId && (
                  <p className="text-xs text-muted-foreground">
                    New total will be: {stock.find(i => i.id === selectedItemId)?.quantity || 0} + {updateQuantity || 0} = {(stock.find(i => i.id === selectedItemId)?.quantity || 0) + parseInt(updateQuantity || "0")} {stock.find(i => i.id === selectedItemId)?.unit}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full">Update Quantity</Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={breakageOpen} onOpenChange={setBreakageOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex-1">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Report Breakage
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report Breakage</DialogTitle>
              <DialogDescription>Report broken or damaged items</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleReportBreakage} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="item">Item Type</Label>
                <Input
                  id="item"
                  value={breakageItem}
                  onChange={(e) => setBreakageItem(e.target.value)}
                  placeholder="e.g., Hookah Pot, Glass, etc."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="breakageQty">Quantity</Label>
                <Input
                  id="breakageQty"
                  type="number"
                  value={breakageQuantity}
                  onChange={(e) => setBreakageQuantity(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cause">Cause of Breakage</Label>
                <Textarea
                  id="cause"
                  value={breakageCause}
                  onChange={(e) => setBreakageCause(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">Submit Report</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {stock.map((item) => (
          <Card key={item.id} className={item.quantity <= item.low_stock_threshold ? "border-warning" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{item.item_name}</CardTitle>
                  <p className="text-xs text-muted-foreground capitalize mt-1">{item.category.replace('_', ' ')}</p>
                </div>
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-2xl font-bold">{item.quantity}</p>
                  <p className="text-sm text-muted-foreground">{item.unit}</p>
                </div>
                {item.quantity <= item.low_stock_threshold && (
                  <div className="text-warning text-sm font-medium">Low Stock</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {stock.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No stock items yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StockWidget;