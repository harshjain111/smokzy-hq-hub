import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
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
import { format } from "date-fns";
import AppreciationDialog from "./AppreciationDialog";
import { useBusinessDate } from "@/hooks/useBusinessDate";

interface StockWidgetProps {
  user: User;
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

interface TaskStatus {
  stockReported: boolean;
  salesReported: boolean;
  closingPhoto: boolean;
}

const StockWidget = ({ user, venueId }: StockWidgetProps) => {
  const { businessDate } = useBusinessDate(user.id, venueId);
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
  const [allItemsUpdatedToday, setAllItemsUpdatedToday] = useState(false);
  const [showAppreciation, setShowAppreciation] = useState(false);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>({
    stockReported: false,
    salesReported: false,
    closingPhoto: false,
  });

  useEffect(() => {
    fetchStock();
    checkTaskStatus();
  }, [venueId, businessDate]);

  const checkTaskStatus = async () => {
    const [stockCheck, salesCheck, closingCheck] = await Promise.all([
      supabase
        .from("stock")
        .select("id, quantity, created_at, updated_at")
        .eq("venue_id", venueId),
      supabase
        .from("sales_reports")
        .select("id")
        .eq("venue_id", venueId)
        .eq("report_date", businessDate)
        .limit(1),
      supabase
        .from("closing_photos")
        .select("id")
        .eq("venue_id", venueId)
        .eq("photo_date", businessDate)
        .limit(1),
    ]);

    let stockReported = false;
    if (stockCheck.data && stockCheck.data.length > 0) {
      stockReported = stockCheck.data.every((item: any) => {
        const itemUpdateDate = format(new Date(item.updated_at), "yyyy-MM-dd");
        return itemUpdateDate === businessDate && item.updated_at !== item.created_at;
      });
    }

    setTaskStatus({
      stockReported,
      salesReported: !!(salesCheck.data && salesCheck.data.length > 0),
      closingPhoto: !!(closingCheck.data && closingCheck.data.length > 0),
    });
  };

  const fetchStock = async () => {
    const { data } = await supabase
      .from("stock")
      .select("*")
      .eq("venue_id", venueId)
      .order("category")
      .order("item_name");

    if (data) {
      setStock(data);
      checkIfAllItemsUpdatedToday(data);
    }
  };

  const checkIfAllItemsUpdatedToday = async (stockData: StockItem[]) => {
    if (stockData.length === 0) {
      setAllItemsUpdatedToday(false);
      await checkTaskStatus();
      return;
    }

    const allUpdated = stockData.every((item: any) => {
      const itemUpdateDate = format(new Date(item.updated_at), "yyyy-MM-dd");
      return itemUpdateDate === businessDate && item.updated_at !== item.created_at;
    });

    setAllItemsUpdatedToday(allUpdated);
    await checkTaskStatus();
  };

  const handleOpenUpdateStock = () => {
    // Pre-fill with current stock values if all items were updated today
    if (allItemsUpdatedToday) {
      const currentValues: Record<string, string> = {};
      stock.forEach((item) => {
        currentValues[item.id] = item.quantity.toString();
      });
      setStockUpdates(currentValues);
    } else {
      setStockUpdates({});
    }
    setUpdateStockOpen(true);
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
    const updates = Object.entries(stockUpdates).filter(([_, qty]) => qty && parseInt(qty) >= 0);
    
    if (updates.length === 0) {
      toast.error("Please enter at least one quantity");
      return;
    }

    try {
      for (const [itemId, currentQty] of updates) {
        const { error } = await supabase
          .from("stock")
          .update({
            quantity: parseInt(currentQty),
          })
          .eq("id", itemId);

        if (error) throw error;
      }

      toast.success(`Updated ${updates.length} item(s) successfully`);
      setStockUpdates({});
      setUpdateStockOpen(false);
      await fetchStock();
      await checkTaskStatus();
      
      // Notify other components immediately
      window.dispatchEvent(new CustomEvent('tasks:updated', { detail: { venueId, source: 'stock_update' } }));
      
      // Show appreciation if all items were updated
      if (updates.length === stock.length) {
        setShowAppreciation(true);
      }
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
      {allItemsUpdatedToday ? (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Today's Stock Updated ✓
            </CardTitle>
            <CardDescription>Your team has updated all stock items for today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              All {stock.length} items have been counted and updated
            </div>
            <Dialog open={updateStockOpen} onOpenChange={setUpdateStockOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" onClick={handleOpenUpdateStock}>
                  <Package className="mr-2 h-4 w-4" />
                  Edit Stock Quantities
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Today's Stock Quantities</DialogTitle>
                  <DialogDescription>Modify the stock quantities entered earlier today</DialogDescription>
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
                              <TableHead className="w-[30%]">Current Stock</TableHead>
                              <TableHead className="w-[30%]">Update To</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stock.filter(item => item.category === 'flavour').map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.item_name}</TableCell>
                                <TableCell className="text-muted-foreground">{item.quantity} {item.unit}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder={item.quantity.toString()}
                                    value={stockUpdates[item.id] || ""}
                                    onChange={(e) => setStockUpdates(prev => ({
                                      ...prev,
                                      [item.id]: e.target.value
                                    }))}
                                    className="w-full"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
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
                              <TableHead className="w-[30%]">Current Stock</TableHead>
                              <TableHead className="w-[30%]">Update To</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stock.filter(item => item.category === 'hookah_pots').map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.item_name}</TableCell>
                                <TableCell className="text-muted-foreground">{item.quantity} {item.unit}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder={item.quantity.toString()}
                                    value={stockUpdates[item.id] || ""}
                                    onChange={(e) => setStockUpdates(prev => ({
                                      ...prev,
                                      [item.id]: e.target.value
                                    }))}
                                    className="w-full"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
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
                              <TableHead className="w-[30%]">Current Stock</TableHead>
                              <TableHead className="w-[30%]">Update To</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stock.filter(item => item.category === 'accessories').map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.item_name}</TableCell>
                                <TableCell className="text-muted-foreground">{item.quantity} {item.unit}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder={item.quantity.toString()}
                                    value={stockUpdates[item.id] || ""}
                                    onChange={(e) => setStockUpdates(prev => ({
                                      ...prev,
                                      [item.id]: e.target.value
                                    }))}
                                    className="w-full"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" onClick={handleUpdateStock} className="flex-1">
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setUpdateStockOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Register New Item Button */}
          <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
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

          {/* Update Stock and Report Breakage - Side by Side */}
          <div className="grid grid-cols-2 gap-3">
            <Dialog open={updateStockOpen} onOpenChange={setUpdateStockOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" onClick={handleOpenUpdateStock} disabled={stock.length === 0}>
                  <Package className="mr-2 h-4 w-4" />
                  Update Stock
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Update Stock Quantities</DialogTitle>
                  <DialogDescription>Enter current stock levels for each item</DialogDescription>
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
                              <TableHead className="w-[50%]">Item Name</TableHead>
                              <TableHead className="w-[50%]">Current Stock</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stock.filter(item => item.category === 'flavour').map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.item_name}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="Enter quantity"
                                    value={stockUpdates[item.id] || ""}
                                    onChange={(e) => setStockUpdates(prev => ({
                                      ...prev,
                                      [item.id]: e.target.value
                                    }))}
                                    className="w-full"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
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
                              <TableHead className="w-[50%]">Item Name</TableHead>
                              <TableHead className="w-[50%]">Current Stock</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stock.filter(item => item.category === 'hookah_pots').map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.item_name}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="Enter quantity"
                                    value={stockUpdates[item.id] || ""}
                                    onChange={(e) => setStockUpdates(prev => ({
                                      ...prev,
                                      [item.id]: e.target.value
                                    }))}
                                    className="w-full"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
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
                              <TableHead className="w-[50%]">Item Name</TableHead>
                              <TableHead className="w-[50%]">Current Stock</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stock.filter(item => item.category === 'accessories').map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.item_name}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="Enter quantity"
                                    value={stockUpdates[item.id] || ""}
                                    onChange={(e) => setStockUpdates(prev => ({
                                      ...prev,
                                      [item.id]: e.target.value
                                    }))}
                                    className="w-full"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" onClick={handleUpdateStock} className="flex-1">
                    <Save className="mr-2 h-4 w-4" />
                    Save Stock Updates
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setUpdateStockOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={breakageOpen} onOpenChange={setBreakageOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
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
        </div>
      )}

      {/* Display Current Stock */}
      <div className="grid gap-2">
        {stock.map((item) => (
          <Card key={item.id} className={item.quantity <= item.low_stock_threshold ? "border-warning" : ""}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <h4 className="font-semibold text-sm">{item.item_name}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">{item.category.replace('_', ' ')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">{item.quantity} {item.unit}</p>
                  {item.quantity <= item.low_stock_threshold && (
                    <span className="text-warning text-xs font-medium">Low Stock</span>
                  )}
                </div>
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

      <AppreciationDialog
        open={showAppreciation}
        onOpenChange={setShowAppreciation}
        taskType="stock"
        taskStatus={taskStatus}
      />
    </div>
  );
};

export default StockWidget;