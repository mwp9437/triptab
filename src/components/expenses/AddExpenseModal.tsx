import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  Plane, Hotel, UtensilsCrossed, Ticket, Bus, Package,
  DollarSign, CalendarIcon, Link2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Expense, Traveler, SplitMethod } from "@/types/expenses";
import { TripPlan, TimeBlock } from "@/types/itinerary";

const CATEGORIES = [
  { value: "flights", label: "Flights", icon: Plane },
  { value: "accommodation", label: "Accommodation", icon: Hotel },
  { value: "food", label: "Food", icon: UtensilsCrossed },
  { value: "activities", label: "Activities", icon: Ticket },
  { value: "transport", label: "Transport", icon: Bus },
  { value: "other", label: "Other", icon: Package },
] as const;

type ExpenseCategory = Expense["category"];

interface AddExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  travelers: Traveler[];
  plan: TripPlan;
  onAddExpense: (expense: Omit<Expense, "id" | "createdAt">) => Promise<void>;
}

export default function AddExpenseModal({
  open,
  onOpenChange,
  travelers,
  plan,
  onAddExpense,
}: AddExpenseModalProps) {
  const currentUser = travelers.find((t) => t.isCurrentUser);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [date, setDate] = useState<Date>(new Date());
  const [paidBy, setPaidBy] = useState<string>(currentUser?.id || "");
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(
    new Set(travelers.map((t) => t.id))
  );
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [customPercents, setCustomPercents] = useState<Record<string, string>>({});
  const [linkedBlockId, setLinkedBlockId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset when travelers change or modal opens
  const resetForm = () => {
    setAmount("");
    setDescription("");
    setCategory("food");
    setDate(new Date());
    setPaidBy(currentUser?.id || travelers[0]?.id || "");
    setSelectedParticipants(new Set(travelers.map((t) => t.id)));
    setSplitMethod("equal");
    setCustomAmounts({});
    setCustomPercents({});
    setLinkedBlockId(null);
  };

  // Trip date constraints
  const tripStart = plan.startDate ? new Date(plan.startDate + "T00:00:00") : undefined;
  const tripEnd = plan.endDate ? new Date(plan.endDate + "T00:00:00") : undefined;

  // Blocks for selected date
  const dateStr = format(date, "yyyy-MM-dd");
  const dayBlocks = useMemo(() => {
    const day = plan.itinerary.find((d) => d.date === dateStr);
    return day?.blocks || [];
  }, [plan.itinerary, dateStr]);

  const participantArray = travelers.filter((t) => selectedParticipants.has(t.id));
  const numericAmount = parseFloat(amount) || 0;

  // Compute shares
  const computedShares = useMemo(() => {
    if (splitMethod === "equal" && participantArray.length > 0) {
      const share = Math.round((numericAmount / participantArray.length) * 100) / 100;
      return Object.fromEntries(participantArray.map((t) => [t.id, share]));
    }
    if (splitMethod === "custom_amount") {
      return Object.fromEntries(
        participantArray.map((t) => [t.id, parseFloat(customAmounts[t.id] || "0") || 0])
      );
    }
    if (splitMethod === "custom_percent") {
      return Object.fromEntries(
        participantArray.map((t) => {
          const pct = parseFloat(customPercents[t.id] || "0") || 0;
          return [t.id, Math.round(numericAmount * pct) / 100];
        })
      );
    }
    return {};
  }, [splitMethod, participantArray, numericAmount, customAmounts, customPercents]);

  const sharesTotal = Object.values(computedShares).reduce((s, v) => s + v, 0);
  const percentTotal = splitMethod === "custom_percent"
    ? participantArray.reduce((s, t) => s + (parseFloat(customPercents[t.id] || "0") || 0), 0)
    : 100;

  const isValid =
    numericAmount > 0 &&
    description.trim() !== "" &&
    paidBy !== "" &&
    participantArray.length > 0 &&
    (splitMethod === "equal" || (splitMethod === "custom_amount" && Math.abs(sharesTotal - numericAmount) < 0.02) || (splitMethod === "custom_percent" && Math.abs(percentTotal - 100) < 0.5));

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      await onAddExpense({
        tripId: plan.destination, // will be overridden by hook
        blockId: linkedBlockId,
        description: description.trim(),
        amount: numericAmount,
        currency: "USD",
        category,
        date: dateStr,
        paidBy,
        participants: participantArray.map((t) => ({
          travelerId: t.id,
          share: computedShares[t.id] ?? 0,
        })),
        splitMethod,
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by parent
    }
    setSubmitting(false);
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="glass-card border-white/15 sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Add Expense</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount */}
          <div className="flex items-center gap-2 glass rounded-2xl px-4 py-3">
            <DollarSign className="w-5 h-5 text-primary shrink-0" />
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-2xl font-display font-bold text-foreground outline-none placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-sm font-body text-muted-foreground font-medium">USD</span>
          </div>

          {/* Description */}
          <Input
            placeholder="What was this for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="glass border-white/20 rounded-xl h-10"
          />

          {/* Category + Date row */}
          <div className="flex gap-2">
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger className="glass border-white/20 rounded-xl flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-card border-white/15">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  return (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" /> {c.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "glass border-white/20 rounded-xl flex-1 justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {format(date, "MMM d")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 glass-card border-white/15" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  disabled={(d) =>
                    (tripStart ? d < tripStart : false) || (tripEnd ? d > tripEnd : false)
                  }
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Paid by */}
          <div className="space-y-1.5">
            <label className="text-xs font-body font-medium text-muted-foreground uppercase tracking-wider">Paid by</label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger className="glass border-white/20 rounded-xl">
                <SelectValue placeholder="Select payer" />
              </SelectTrigger>
              <SelectContent className="glass-card border-white/15">
                {travelers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.isCurrentUser ? "(you)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Split between */}
          <div className="space-y-1.5">
            <label className="text-xs font-body font-medium text-muted-foreground uppercase tracking-wider">Split between</label>
            <div className="glass rounded-xl p-2.5 space-y-1">
              {travelers.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedParticipants.has(t.id)}
                    onCheckedChange={() => toggleParticipant(t.id)}
                  />
                  <span className="text-sm font-body text-foreground flex-1">
                    {t.name} {t.isCurrentUser ? "(you)" : ""}
                  </span>
                  {splitMethod === "equal" && selectedParticipants.has(t.id) && numericAmount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ${(computedShares[t.id] ?? 0).toFixed(2)}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Split method */}
          <div className="space-y-1.5">
            <label className="text-xs font-body font-medium text-muted-foreground uppercase tracking-wider">Split method</label>
            <div className="flex gap-1 glass rounded-xl p-1">
              {([
                { value: "equal", label: "Equally" },
                { value: "custom_amount", label: "Custom $" },
                { value: "custom_percent", label: "Custom %" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSplitMethod(opt.value)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-body font-medium transition-all",
                    splitMethod === opt.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom inputs */}
          {splitMethod === "custom_amount" && participantArray.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-body text-muted-foreground">Custom amounts</label>
                <span
                  className={cn(
                    "text-xs font-body",
                    Math.abs(sharesTotal - numericAmount) < 0.02 ? "text-primary" : "text-destructive"
                  )}
                >
                  ${sharesTotal.toFixed(2)} / ${numericAmount.toFixed(2)}
                </span>
              </div>
              <div className="glass rounded-xl p-2.5 space-y-1.5">
                {participantArray.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="text-sm font-body text-foreground flex-1 truncate">{t.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={customAmounts[t.id] || ""}
                        onChange={(e) =>
                          setCustomAmounts((prev) => ({ ...prev, [t.id]: e.target.value }))
                        }
                        className="w-20 bg-white/10 rounded-lg px-2 py-1 text-sm text-foreground outline-none border border-white/15 focus:border-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {splitMethod === "custom_percent" && participantArray.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-body text-muted-foreground">Custom percentages</label>
                <span
                  className={cn(
                    "text-xs font-body",
                    Math.abs(percentTotal - 100) < 0.5 ? "text-primary" : "text-destructive"
                  )}
                >
                  {percentTotal.toFixed(0)}% / 100%
                </span>
              </div>
              <div className="glass rounded-xl p-2.5 space-y-1.5">
                {participantArray.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="text-sm font-body text-foreground flex-1 truncate">{t.name}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={customPercents[t.id] || ""}
                        onChange={(e) =>
                          setCustomPercents((prev) => ({ ...prev, [t.id]: e.target.value }))
                        }
                        className="w-16 bg-white/10 rounded-lg px-2 py-1 text-sm text-foreground outline-none border border-white/15 focus:border-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                    {numericAmount > 0 && (
                      <span className="text-[11px] text-muted-foreground w-14 text-right">
                        ${(computedShares[t.id] ?? 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link to activity */}
          {dayBlocks.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-body font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Link2 className="w-3 h-3" /> Link to activity
              </label>
              <Select value={linkedBlockId || "__none__"} onValueChange={(v) => setLinkedBlockId(v === "__none__" ? null : v)}>
                <SelectTrigger className="glass border-white/20 rounded-xl">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="glass-card border-white/15">
                  <SelectItem value="__none__">None</SelectItem>
                  {dayBlocks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.startTime} — {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="w-full rounded-xl h-11 font-display font-semibold text-sm"
          >
            {submitting ? "Adding..." : "Add Expense"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
