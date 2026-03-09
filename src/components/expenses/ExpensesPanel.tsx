import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, Plane, Hotel, UtensilsCrossed, Ticket, Bus, Package,
  Plus, Trash2, ChevronDown, ChevronUp, ArrowRight, Check, Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Expense, Traveler } from "@/types/expenses";
import { TripPlan } from "@/types/itinerary";
import { calculateSettlements, getCategoryTotals } from "@/lib/settlements";
import { toast } from "@/hooks/use-toast";
import AddExpenseModal from "./AddExpenseModal";
import type { ExpenseInitialValues } from "./AddExpenseModal";

const CATEGORY_ICONS: Record<string, typeof Plane> = {
  flights: Plane,
  accommodation: Hotel,
  food: UtensilsCrossed,
  activities: Ticket,
  transport: Bus,
  other: Package,
};

const CATEGORY_LABELS: Record<string, string> = {
  flights: "Flights",
  accommodation: "Accommodation",
  food: "Food & Dining",
  activities: "Activities",
  transport: "Transport",
  other: "Other",
};

interface ExpensesPanelProps {
  expenses: Expense[];
  travelers: Traveler[];
  plan: TripPlan;
  tripId: string | null;
  onAddExpense: (expense: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  onSave?: () => void;
  onOpenTravelers?: () => void;
  initialValues?: ExpenseInitialValues;
  onClearInitialValues?: () => void;
}

export default function ExpensesPanel({
  expenses,
  travelers,
  plan,
  tripId,
  onAddExpense,
  onDeleteExpense,
  onSave,
  onOpenTravelers,
  initialValues,
  onClearInitialValues,
}: ExpensesPanelProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [settledItems, setSettledItems] = useState<Set<number>>(new Set());

  // Auto-open modal when initialValues are provided
  const handleAddModalChange = (open: boolean) => {
    setAddModalOpen(open);
    if (!open && onClearInitialValues) onClearInitialValues();
  };

  // Open modal if initialValues arrive
  useEffect(() => {
    if (initialValues && !addModalOpen) {
      setAddModalOpen(true);
    }
  }, [initialValues]);

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const categoryTotals = useMemo(() => getCategoryTotals(expenses), [expenses]);
  const { balances, settlements } = useMemo(
    () => calculateSettlements(expenses, travelers),
    [expenses, travelers]
  );

  const travelerMap = useMemo(
    () => Object.fromEntries(travelers.map((t) => [t.id, t])),
    [travelers]
  );

  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [expenses]
  );

  // If no tripId, prompt to save
  if (!tripId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-full glass flex items-center justify-center mb-4">
          <DollarSign className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="font-display font-semibold text-foreground mb-1">Save your trip first</p>
        <p className="text-sm text-muted-foreground font-body mb-4">
          Expenses are stored in the cloud. Save your trip to start tracking spending.
        </p>
        {onSave && (
          <Button onClick={onSave} className="rounded-xl">
            Save Trip
          </Button>
        )}
      </div>
    );
  }

  // No travelers yet
  if (travelers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-full glass flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="font-display font-semibold text-foreground mb-1">Add travelers first</p>
        <p className="text-sm text-muted-foreground font-body mb-4">
          Add travelers to start splitting expenses
        </p>
        {onOpenTravelers && (
          <Button onClick={onOpenTravelers} className="rounded-xl gap-1.5">
            <Users className="w-4 h-4" /> Manage Travelers
          </Button>
        )}
      </div>
    );
  }

  // No expenses yet (with travelers)
  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-full glass flex items-center justify-center mb-4">
          <DollarSign className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="font-display font-semibold text-foreground mb-1">No expenses logged yet</p>
        <p className="text-sm text-muted-foreground font-body mb-4">
          Start tracking spending to see who owes what
        </p>
        <Button onClick={() => setAddModalOpen(true)} className="rounded-xl gap-1.5">
          <Plus className="w-4 h-4" /> Add Expense
        </Button>
        <AddExpenseModal
          open={addModalOpen}
          onOpenChange={handleAddModalChange}
          travelers={travelers}
          plan={plan}
          onAddExpense={onAddExpense}
          initialValues={initialValues}
        />
      </div>
    );
  }

  const maxCatAmount = Math.max(...Object.values(categoryTotals), 1);

  return (
    <div className="space-y-4 relative pb-16">
      {/* Summary Card */}
      <Card className="rounded-2xl border-white/15 glass-card shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            Spending Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-center py-2">
            <p className="text-3xl font-display font-bold text-foreground">
              ${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              total spent · {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Category breakdown with estimated vs actual */}
          <div className="space-y-2">
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
              const actual = categoryTotals[cat] || 0;
              const estimated = (plan.budget.categories[cat] as number) || 0;
              if (actual === 0 && estimated === 0) return null;
              const Icon = CATEGORY_ICONS[cat];
              const overBudget = estimated > 0 && actual > estimated;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-body">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Icon className="w-3 h-3" /> {label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={cn("font-medium", overBudget ? "text-destructive" : "text-foreground")}>
                        ${actual.toLocaleString()}
                      </span>
                      {estimated > 0 && (
                        <span className="text-muted-foreground/60">
                          / ${estimated.toLocaleString()}
                        </span>
                      )}
                    </span>
                  </div>
                  {estimated > 0 && (
                    <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          overBudget ? "bg-destructive/70" : "bg-primary/60"
                        )}
                        style={{ width: `${Math.min((actual / estimated) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                  {!estimated && (
                    <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/40"
                        style={{ width: `${Math.min((actual / maxCatAmount) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Balances Card */}
      {travelers.length > 1 && (
        <Card className="rounded-2xl border-white/15 glass-card shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="text-sm">⚖️</span> Balances
              </span>
              {settlements.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-white/20 glass text-xs h-7"
                  onClick={() => setSettleOpen(true)}
                >
                  Settle Up
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {travelers.map((t) => {
              const bal = balances[t.id] ?? 0;
              if (Math.abs(bal) < 0.01) return (
                <div key={t.id} className="flex items-center justify-between text-sm font-body px-1 py-1">
                  <span className="text-foreground">{t.name}</span>
                  <span className="text-muted-foreground">settled ✓</span>
                </div>
              );
              return (
                <div key={t.id} className="flex items-center justify-between text-sm font-body px-1 py-1">
                  <span className="text-foreground">{t.name}</span>
                  <span className={cn("font-medium", bal > 0 ? "text-sage" : "text-destructive")}>
                    {bal > 0 ? `is owed $${bal.toFixed(2)}` : `owes $${Math.abs(bal).toFixed(2)}`}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Settle Up Modal */}
      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="glass-card border-white/15 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Settle Up</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {settlements.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body text-center py-4">
                Everyone is settled up! 🎉
              </p>
            ) : (
              settlements.map((s, i) => (
                <label
                  key={i}
                  className={cn(
                    "flex items-center gap-3 glass rounded-xl px-3 py-2.5 cursor-pointer transition-all",
                    settledItems.has(i) && "opacity-50"
                  )}
                >
                  <Checkbox
                    checked={settledItems.has(i)}
                    onCheckedChange={() =>
                      setSettledItems((prev) => {
                        const next = new Set(prev);
                        next.has(i) ? next.delete(i) : next.add(i);
                        return next;
                      })
                    }
                  />
                  <span className="text-sm font-body text-foreground flex-1 flex items-center gap-1.5">
                    <span className="font-medium">{travelerMap[s.from]?.name ?? "?"}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium">{travelerMap[s.to]?.name ?? "?"}</span>
                  </span>
                  <span className="text-sm font-display font-bold text-foreground">
                    ${s.amount.toFixed(2)}
                  </span>
                </label>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense List */}
      <div className="space-y-1.5">
        {sortedExpenses.length === 0 && (
          <p className="text-sm text-muted-foreground font-body text-center py-6">
            No expenses yet. Tap + to add one.
          </p>
        )}
        {sortedExpenses.map((exp) => {
          const Icon = CATEGORY_ICONS[exp.category] || Package;
          const payer = travelerMap[exp.paidBy];
          const isExpanded = expandedExpense === exp.id;
          return (
            <motion.div
              key={exp.id}
              layout
              className="glass rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedExpense(isExpanded ? null : exp.id)}
                className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium text-foreground truncate">{exp.description}</p>
                  <p className="text-[11px] text-muted-foreground font-body">
                    {payer ? `Paid by ${payer.name}` : ""} · Split {exp.participants.length} way{exp.participants.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sm font-display font-bold text-foreground">
                    ${exp.amount.toFixed(2)}
                  </span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 pt-0 space-y-2 border-t border-white/10">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2">
                        <span className="text-[11px] text-muted-foreground">Date</span>
                        <span className="text-[11px] text-foreground text-right">{exp.date}</span>
                        <span className="text-[11px] text-muted-foreground">Category</span>
                        <span className="text-[11px] text-foreground text-right capitalize">{exp.category}</span>
                        <span className="text-[11px] text-muted-foreground">Split</span>
                        <span className="text-[11px] text-foreground text-right capitalize">{exp.splitMethod.replace("_", " ")}</span>
                      </div>
                      <div className="space-y-1 pt-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-body font-medium">Breakdown</p>
                        {exp.participants.map((p) => (
                          <div key={p.travelerId} className="flex justify-between text-xs font-body">
                            <span className="text-foreground">{travelerMap[p.travelerId]?.name ?? "Unknown"}</span>
                            <span className="text-muted-foreground">${p.share.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      {deleteConfirm === exp.id ? (
                        <div className="flex gap-2 pt-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="rounded-xl flex-1 h-7 text-xs"
                            onClick={async () => {
                              await onDeleteExpense(exp.id);
                              toast({ title: "Expense deleted", description: `"${exp.description}" removed.` });
                              setDeleteConfirm(null);
                              setExpandedExpense(null);
                            }}
                          >
                            Confirm Delete
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl flex-1 h-7 text-xs border-white/20"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full rounded-xl h-7 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteConfirm(exp.id)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Fixed Add button */}
      <div className="sticky bottom-0 pt-2 pb-1">
        <Button
          onClick={() => setAddModalOpen(true)}
          className="w-full rounded-xl h-10 font-display font-semibold text-sm gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Expense
        </Button>
      </div>

      <AddExpenseModal
        open={addModalOpen}
        onOpenChange={handleAddModalChange}
        travelers={travelers}
        plan={plan}
        onAddExpense={onAddExpense}
        initialValues={initialValues}
      />
    </div>
  );
}
