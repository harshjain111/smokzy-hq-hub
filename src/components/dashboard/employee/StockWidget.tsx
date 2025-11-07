import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Package, Plus, AlertTriangle, Save } from "lucide-react";

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
  const [stockUpdates, setStockUpdates] = useState<Record<string, string>>({});
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

  const handleUpdateStock = async () => {
    const updates = Object.entries(stockUpdates).filter(([_, qty]) => qty && parseInt(qty) > 0);
    
    if (updates.length === 0) {
      toast.error("Please enter at least one quantity");
      return;
    }

    try {
      for (const [itemId, addedQty] of updates) {
        const item = stock.find(s => s.id === itemId);
        if (!item) continue;

        const { error } = await supabase
          .from("stock")
          .update({
            quantity: item.quantity + parseInt(addedQty),
          })
          .eq("id", itemId);

        if (error) throw error;
      }

      toast.success(`Updated ${updates.length} item(s) successfully`);
      setStockUpdates({});
      setUpdateStockOpen(false);
      fetchStock();
    } catch (error) {
      toast.error("Failed to update stock");
      console.error(error);
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
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Stock Quantities</DialogTitle>
              <DialogDescription>Enter quantities to add for each item (current stock will be updated)</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Flavours Section */}
              {stock.filter(item => item.category === 'flavour').length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Flavours</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[40%]">Item Name</TableHead>
                          <TableHead className="w-[20%]">Current Stock</TableHead>
                          <TableHead className="w-[20%]">Add Quantity</TableHead>
                          <TableHead className="w-[20%]">New Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stock.filter(item => item.category === 'flavour').map((item) => {
                          const addedQty = parseInt(stockUpdates[item.id] || "0");
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.item_name}</TableCell>
                              <TableCell>{item.quantity} {item.unit}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={stockUpdates[item.id] || ""}
                                  onChange={(e) => setStockUpdates(prev => ({
                                    ...prev,
                                    [item.id]: e.target.value
                                  }))}
                                  className="w-full"
                                />
                              </TableCell>
                              <TableCell className="font-semibold">
                                {item.quantity + addedQty} {item.unit}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Hookah Pots Section */}
              {stock.filter(item => item.category === 'hookah_pots').length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Hookah Pots</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[40%]">Item Name</TableHead>
                          <TableHead className="w-[20%]">Current Stock</TableHead>
                          <TableHead className="w-[20%]">Add Quantity</TableHead>
                          <TableHead className="w-[20%]">New Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stock.filter(item => item.category === 'hookah_pots').map((item) => {
                          const addedQty = parseInt(stockUpdates[item.id] || "0");
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.item_name}</TableCell>
                              <TableCell>{item.quantity} {item.unit}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={stockUpdates[item.id] || ""}
                                  onChange={(e) => setStockUpdates(prev => ({
                                    ...prev,
                                    [item.id]: e.target.value
                                  }))}
                                  className="w-full"
                                />
                              </TableCell>
                              <TableCell className="font-semibold">
                                {item.quantity + addedQty} {item.unit}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Accessories Section */}
              {stock.filter(item => item.category === 'accessories').length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Accessories</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[40%]">Item Name</TableHead>
                          <TableHead className="w-[20%]">Current Stock</TableHead>
                          <TableHead className="w-[20%]">Add Quantity</TableHead>
                          <TableHead className="w-[20%]">New Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stock.filter(item => item.category === 'accessories').map((item) => {
                          const addedQty = parseInt(stockUpdates[item.id] || "0");
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.item_name}</TableCell>
                              <TableCell>{item.quantity} {item.unit}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={stockUpdates[item.id] || ""}
                                  onChange={(e) => setStockUpdates(prev => ({
                                    ...prev,
                                    [item.id]: e.target.value
                                  }))}
                                  className="w-full"
                                />
                              </TableCell>
                              <TableCell className="font-semibold">
                                {item.quantity + addedQty} {item.unit}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {stock.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No items registered yet. Please register items first.
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={handleUpdateStock} className="flex-1">
                <Save className="mr-2 h-4 w-4" />
                Save All Updates
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setStockUpdates({});
                  setUpdateStockOpen(false);
                }}
              >
                Cancel
              </Button>
            </div>
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