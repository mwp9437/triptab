import { useState, useRef, useEffect } from "react";
import { DollarSign, Target, TrendingUp, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TripPlan, TimeBlock } from "@/types/itinerary";

interface MyBudgetPanelProps {
  plan: TripPlan;
  isOptedIn: (blockId: string) => boolean;
  budgetCap: number | null;
  onSetBudgetCap: (cap: number | null) => void;
  tripId: string | null | undefined;
}

export default function MyBudgetPanel({ plan, isOptedIn, budgetCap, onSetBudgetCap, tripId }: MyBudgetPanelProps) {
  const [editingCap, setEditingCap] = useState(false);
  const [capValue, setCapValue] = useState(String(budgetCap ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCap) {
      setCapValue(String(budgetCap ?? ""));
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editingCap]);

  if (!tripId) return null;

  // Calculate personal spending from opted-in blocks
  let myTotal = 0;
  const categoryTotals: Record<string, number> = {};

  plan.itinerary.forEach((day) => {
    day.blocks.forEach((block) => {
      if (isOptedIn(block.id) && block.cost && block.cost > 0) {
        const perPerson = block.cost / (plan.travelers || 1);
        myTotal += perPerson;
        const cat = block.category;
        categoryTotals[cat] = (categoryTotals[cat] || 0) + perPerson;
      }
    });
  });

  const overBudget = budgetCap != null && myTotal > budgetCap;
  const budgetPercent = budgetCap ? Math.min((myTotal / budgetCap) * 100, 100) : 0;

  const commitCap = () => {
    const num = parseFloat(capValue);
    if (!isNaN(num) && num > 0) {
      onSetBudgetCap(Math.round(num * 100) / 100);
    } else if (capValue.trim() === "") {
      onSetBudgetCap(null);
    }
    setEditingCap(false);
  };

  return (
    <Card className="rounded-2xl border-white/15 glass-card shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            My Budget
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Budget cap */}
        <div className="flex justify-between items-center text-sm font-body">
          <span className="text-muted-foreground">Budget cap</span>
          {editingCap ? (
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              <input
                ref={inputRef}
                type="number"
                min="0"
                step="1"
                value={capValue}
                onChange={(e) => setCapValue(e.target.value)}
                onBlur={commitCap}
                onKeyDown={(e) => { if (e.key === "Enter") commitCap(); if (e.key === "Escape") setEditingCap(false); }}
                placeholder="No limit"
                className="w-20 bg-transparent border-b border-primary text-sm font-semibold outline-none text-foreground"
              />
            </span>
          ) : (
            <button
              onClick={() => setEditingCap(true)}
              className="font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
              title="Click to set budget cap"
            >
              {budgetCap != null ? `$${budgetCap.toLocaleString()}` : "Set cap →"}
            </button>
          )}
        </div>

        {/* Progress bar (only if cap is set) */}
        {budgetCap != null && (
          <Progress value={budgetPercent} className={`h-2 ${overBudget ? "[&>div]:bg-destructive" : ""}`} />
        )}

        {/* My total */}
        <div className="flex justify-between text-sm font-body">
          <span className="text-muted-foreground">My estimated cost</span>
          <span className={`font-semibold ${overBudget ? "text-destructive" : "text-foreground"}`}>
            ${Math.round(myTotal).toLocaleString()}
          </span>
        </div>

        {/* Per-category breakdown */}
        {Object.keys(categoryTotals).length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {Object.entries(categoryTotals).map(([cat, amount]) => (
              <div key={cat} className="flex justify-between text-xs font-body text-muted-foreground">
                <span className="capitalize">{cat}</span>
                <span>${Math.round(amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {overBudget && (
          <p className="text-xs text-destructive font-body flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Over budget by ${Math.round(myTotal - (budgetCap || 0)).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
