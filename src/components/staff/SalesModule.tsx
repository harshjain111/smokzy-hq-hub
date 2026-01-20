import { useState, useEffect, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Minus, Plus, Check, TrendingUp, Loader2 } from "lucide-react";
import { ClubSession } from "@/hooks/useClubSession";
import { format } from "date-fns";
import KotProofSection from "./KotProofSection";

interface SalesModuleProps {
  user: User;
  venueId: string;
  session: ClubSession | null;
  updateSessionTask: (task: 'stock' | 'sales' | 'photo', submittedBy: string) => Promise<void>;
}

interface Category {
  id: string;
  category_name: string;
}

const SalesModule = ({ user, venueId, session, updateSessionTask }: SalesModuleProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitterName, setSubmitterName] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("venue_hookah_categories")
      .select("id, category_name")
      .eq("venue_id", venueId)
      .order("category_name");

    if (data) {
      setCategories(data);
      // Initialize quantities with 0
      const initialQuantities: Record<string, number> = {};
      data.forEach(cat => {
        initialQuantities[cat.id] = 0;
      });
      setQuantities(initialQuantities);
    }
    setLoading(false);
  }, [venueId]);

  const fetchSubmitterInfo = useCallback(async () => {
    if (!session?.sales_submitted_by || !session?.sales_submitted_at) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.sales_submitted_by)
      .single();

    if (profile) {
      setSubmitterName(profile.full_name);
      setSubmittedAt(new Date(session.sales_submitted_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }));
    }
  }, [session]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (session?.sales_submitted) {
      fetchSubmitterInfo();
    }
  }, [session, fetchSubmitterInfo]);

  const handleQuantityChange = (categoryId: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [categoryId]: Math.max(0, (prev[categoryId] || 0) + delta),
    }));
  };

  const handleDirectInput = (categoryId: string, value: string) => {
    const num = parseInt(value) || 0;
    setQuantities(prev => ({
      ...prev,
      [categoryId]: Math.max(0, num),
    }));
  };

  const handleSubmit = async () => {
    // Check if at least one category has sales
    const hasAnySales = Object.values(quantities).some(qty => qty > 0);
    
    if (!hasAnySales) {
      toast.error("Please enter at least one sale");
      return;
    }

    setSubmitting(true);
    try {
      const sessionDate = session?.session_date || format(new Date(), "yyyy-MM-dd");

      // Insert sales for categories with quantity > 0
      for (const [categoryId, qty] of Object.entries(quantities)) {
        if (qty > 0) {
          const { error } = await supabase.from("sales_reports").insert({
            venue_id: venueId,
            reported_by: user.id,
            report_date: sessionDate,
            category_id: categoryId,
            quantity_sold: qty,
          });

          if (error) throw error;
        }
      }

      // Update session
      await updateSessionTask('sales', user.id);
      
      toast.success("Sales logged. Session is on track! 📊");
    } catch (error: any) {
      console.error("Sales submit error:", error);
      toast.error(error.message || "Failed to submit sales");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="mt-2 text-muted-foreground">Loading categories...</p>
      </div>
    );
  }

  // Already submitted state
  if (session?.sales_submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 space-y-6">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
          <Check className="w-10 h-10 text-success" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Sales Logged</h2>
          {submitterName && submittedAt && (
            <p className="text-muted-foreground">
              By {submitterName} at {submittedAt}
            </p>
          )}
        </div>
        <div className="bg-success/5 border border-success/20 rounded-2xl p-4 text-center max-w-xs">
          <p className="text-sm text-success font-medium">
            Session is on track!
          </p>
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 space-y-4">
        <TrendingUp className="w-16 h-16 text-muted-foreground/50" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">No Categories</h2>
          <p className="text-muted-foreground text-sm">
            Ask your admin to set up hookah categories for this venue
          </p>
        </div>
      </div>
    );
  }

  const totalSales = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] pb-20">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Log Today's Sales</h2>
          <p className="text-sm text-muted-foreground">Enter quantity sold per category</p>
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 px-4 py-4 space-y-3">
        {categories.map(category => (
          <div
            key={category.id}
            className="flex items-center justify-between p-4 bg-card border border-border rounded-xl"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{category.category_name}</p>
            </div>
            
            {/* Counter */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-xl shrink-0"
                onClick={() => handleQuantityChange(category.id, -1)}
              >
                <Minus className="w-5 h-5" />
              </Button>
              <Input
                type="number"
                min="0"
                value={quantities[category.id] || 0}
                onChange={(e) => handleDirectInput(category.id, e.target.value)}
                className="w-16 h-12 text-center text-lg font-semibold rounded-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-xl shrink-0"
                onClick={() => handleQuantityChange(category.id, 1)}
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </div>
        ))}

        {/* Total */}
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Hookahs</p>
          <p className="text-3xl font-bold text-foreground">{totalSales}</p>
        </div>

        {/* KOT Proof Section */}
        {session?.id && (
          <KotProofSection
            user={user}
            venueId={venueId}
            sessionId={session.id}
          />
        )}
      </div>

      {/* Submit button - fixed at bottom */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-background border-t border-border">
        <Button
          onClick={handleSubmit}
          disabled={submitting || categories.length === 0}
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
              Log Sales
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default SalesModule;
