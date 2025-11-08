import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { TrendingUp, Plus } from "lucide-react";
import { format } from "date-fns";
import AppreciationDialog from "./AppreciationDialog";

interface SalesWidgetProps {
  user: User;
  venueId: string;
}

interface TaskStatus {
  stockReported: boolean;
  salesReported: boolean;
  closingPhoto: boolean;
}

const SalesWidget = ({ user, venueId }: SalesWidgetProps) => {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [todaySales, setTodaySales] = useState<any[]>([]);
  const [hookahCategories, setHookahCategories] = useState<{ id: string; name: string }[]>([]);
  const [showSalesAppreciation, setShowSalesAppreciation] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>({
    stockReported: false,
    salesReported: false,
    closingPhoto: false,
  });

  useEffect(() => {
    fetchHookahCategories();
    fetchTodaySales();
    checkTaskStatus();
  }, [venueId]);

  const checkTaskStatus = async () => {
    const today = format(new Date(), "yyyy-MM-dd");

    const [stockCheck, salesCheck, closingCheck] = await Promise.all([
      supabase
        .from("stock")
        .select("id, quantity, created_at, updated_at")
        .eq("venue_id", venueId),
      supabase
        .from("sales_reports")
        .select("id")
        .eq("venue_id", venueId)
        .eq("report_date", today)
        .limit(1),
      supabase
        .from("closing_photos")
        .select("id")
        .eq("venue_id", venueId)
        .eq("photo_date", today)
        .limit(1),
    ]);

    let stockReported = false;
    if (stockCheck.data && stockCheck.data.length > 0) {
      const todayDate = format(new Date(), "yyyy-MM-dd");
      stockReported = stockCheck.data.every((item: any) => {
        const itemUpdateDate = format(new Date(item.updated_at), "yyyy-MM-dd");
        return itemUpdateDate === todayDate && item.updated_at !== item.created_at;
      });
    }

    setTaskStatus({
      stockReported,
      salesReported: !!(salesCheck.data && salesCheck.data.length > 0),
      closingPhoto: !!(closingCheck.data && closingCheck.data.length > 0),
    });
  };

  const fetchHookahCategories = async () => {
    const { data } = await supabase
      .from("venue_hookah_categories")
      .select("id, category_name")
      .eq("venue_id", venueId)
      .order("category_name");

    if (data) {
      setHookahCategories(data.map(cat => ({ id: cat.id, name: cat.category_name })));
      if (data.length > 0 && !categoryId) {
        setCategoryId(data[0].id);
      }
    }
  };

  const fetchTodaySales = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("sales_reports")
      .select("*, venue_hookah_categories(category_name)")
      .eq("venue_id", venueId)
      .eq("report_date", today);

    setTodaySales(data || []);
  };

  const handleSubmitSales = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId) {
      toast.error("Please select a category");
      return;
    }

    const today = format(new Date(), "yyyy-MM-dd");

    const { error } = await supabase.from("sales_reports").insert({
      venue_id: venueId,
      reported_by: user.id,
      report_date: today,
      category_id: categoryId,
      quantity_sold: parseInt(quantity),
    });

    if (error) {
      toast.error("Failed to submit sales");
      console.error(error);
    } else {
      toast.success("Sales reported successfully");
      setQuantity("");
      setOpen(false);
      fetchTodaySales();
      setShowSalesAppreciation(true);
    }
  };

  const handleEditSale = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingSale) return;

    const { error } = await supabase
      .from("sales_reports")
      .update({ quantity_sold: parseInt(quantity) })
      .eq("id", editingSale.id);

    if (error) {
      toast.error("Failed to update sales");
      console.error(error);
    } else {
      toast.success("Sales updated successfully");
      setQuantity("");
      setEditOpen(false);
      setEditingSale(null);
      fetchTodaySales();
      checkTaskStatus();
    }
  };

  const openEditDialog = (sale: any) => {
    setEditingSale(sale);
    setQuantity(sale.quantity_sold.toString());
    setEditOpen(true);
  };

  const totalSales = todaySales.reduce((sum, sale) => sum + sale.quantity_sold, 0);

  return (
    <div className="space-y-4">
      {todaySales.length > 0 ? (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Today's Sales Reported ✓
            </CardTitle>
            <CardDescription>Your team has reported sales for today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Total Sales: {totalSales} hookahs</div>
              <div className="space-y-2">
                {todaySales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div>
                      <div className="font-medium">{sale.venue_hookah_categories?.category_name}</div>
                      <div className="text-sm text-muted-foreground">{sale.quantity_sold} sold</div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(sale)}
                    >
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add More Sales
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report Additional Sales</DialogTitle>
                  <DialogDescription>Add sales for another category</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmitSales} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Hookah Category</Label>
                    {hookahCategories.length > 0 ? (
                      <Select value={categoryId} onValueChange={setCategoryId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {hookahCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground">No categories available</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity Sold</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      placeholder="Enter quantity"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">Submit Sales</Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              Report Sales
            </CardTitle>
            <CardDescription>Submit today's sales by category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Report Sales
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report Daily Sales</DialogTitle>
                  <DialogDescription>Enter sales by hookah category</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmitSales} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Hookah Category</Label>
                    {hookahCategories.length > 0 ? (
                      <Select value={categoryId} onValueChange={setCategoryId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {hookahCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                        No hookah categories configured for this venue. Please contact admin.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qty">Quantity Sold</Label>
                    <Input
                      id="qty"
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={hookahCategories.length === 0}>
                    Submit Sales
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {todaySales.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">Today's Sales</h3>
                {todaySales.map((sale) => (
                  <Card key={sale.id}>
                    <CardContent className="py-3">
                      <div className="flex justify-between items-center">
                        <span className="capitalize">{sale.venue_hookah_categories?.category_name || 'Unknown'}</span>
                        <span className="font-bold">{sale.quantity_sold} units</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Sales Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sales</DialogTitle>
            <DialogDescription>Update the quantity for {editingSale?.venue_hookah_categories?.category_name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSale} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-quantity">Quantity Sold</Label>
              <Input
                id="edit-quantity"
                type="number"
                min="0"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Save Changes</Button>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AppreciationDialog
        open={showSalesAppreciation}
        onOpenChange={setShowSalesAppreciation}
        taskType="sales"
        taskStatus={taskStatus}
      />
    </div>
  );
};

export default SalesWidget;