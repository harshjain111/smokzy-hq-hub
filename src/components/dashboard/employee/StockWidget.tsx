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
  flavour_name: string;
  quantity: number;
  low_stock_threshold: number;
  unit: string;
}

const StockWidget = ({ venueId }: StockWidgetProps) => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [open, setOpen] = useState(false);
  const [breakageOpen, setBreakageOpen] = useState(false);
  const [flavourName, setFlavourName] = useState("");
  const [quantity, setQuantity] = useState("");
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
      .order("flavour_name");

    setStock(data || []);
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("stock").upsert(
      {
        venue_id: venueId,
        flavour_name: flavourName,
        quantity: parseInt(quantity),
      },
      { onConflict: "venue_id,flavour_name" }
    );

    if (error) {
      toast.error("Failed to update stock");
    } else {
      toast.success("Stock updated successfully");
      setFlavourName("");
      setQuantity("");
      setOpen(false);
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="flex-1">
              <Plus className="mr-2 h-4 w-4" />
              Update Stock
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Stock</DialogTitle>
              <DialogDescription>Add or update flavour stock</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddStock} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="flavour">Flavour Name</Label>
                <Input
                  id="flavour"
                  value={flavourName}
                  onChange={(e) => setFlavourName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">Update Stock</Button>
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
                <CardTitle className="text-base">{item.flavour_name}</CardTitle>
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