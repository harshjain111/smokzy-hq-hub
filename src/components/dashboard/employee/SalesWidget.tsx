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

const SalesWidget = ({ user, venueId }: SalesWidgetProps) => {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [todaySales, setTodaySales] = useState<any[]>([]);
  const [hookahCategories, setHookahCategories] = useState<{ id: string; name: string }[]>([]);
  const [showSalesAppreciation, setShowSalesAppreciation] = useState(false);

  useEffect(() => {
    fetchHookahCategories();
    fetchTodaySales();
  }, [venueId]);

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

  const totalSales = todaySales.reduce((sum, sale) => sum + sale.quantity_sold, 0);

  return (
    <div className="space-y-4">
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

      <AppreciationDialog
        open={showSalesAppreciation}
        onOpenChange={setShowSalesAppreciation}
        taskType="sales"
      />
    </div>
  );
};

export default SalesWidget;