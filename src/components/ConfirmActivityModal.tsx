import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, DollarSign, Users } from "lucide-react";
import { TimeBlock, CostType } from "@/types/itinerary";
import { Expense, Traveler, SplitMethod } from "@/types/expenses";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ConfirmActivityModalProps {
  open: boolean;
  onClose: () => void;
  block: TimeBlock | null;
  dayDate: string;
  dayIndex: number;
  travelers: Traveler[];
  onConfirm: (dayIndex: number, blockId: string, updates: Partial<TimeBlock>) => void;
  onAddExpense?: (expense: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  tripId?: string | null;
}

const BLOCK_TO_EXPENSE_CATEGORY: Record<string, Expense["category"]> = {
  transport: "transport",
  activity: "activities",
  meal: "food",
  accommodation: "accommodation",
  free: "other",
};

export default function ConfirmActivityModal({
  open,
  onClose,
  block,
  dayDate,
  dayIndex,
  travelers,
  onConfirm,
  onAddExpense,
  tripId,
}: ConfirmActivityModalProps) {
  const isMobile = useIsMobile();
  const [stage, setStage] = useState<1 | 2>(1);

  // Stage 1 state
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("");
  const [costType, setCostType] = useState<CostType>("total");
  const [participants, setParticipants] = useState<Set<string>>(new Set());

  // Stage 2 state
  const [actualCost, setActualCost] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equal");

  // Reset form when block changes
  const resetForm = () => {
    setStage(1);
    if (block) {
      setTitle(block.title);
      setCost(block.cost != null ? String(block.cost) : "");
      setCostType(block.costType || (block.category === "transport" ? "per_person" : "total"));
      setParticipants(new Set(travelers.map((t) => t.id)));
      setPaidBy(travelers.find((t) => t.isCurrentUser)?.id || travelers[0]?.id || "");
      setActualCost("");
    }
  };

  // Reset when modal opens with new block
  useState(() => { resetForm(); });

  // Re-sync when block/open changes
  if (open && block && title === "" && stage === 1) {
    resetForm();
  }

  const numericCost = parseFloat(cost) || 0;
  const participantCount = participants.size;
  const totalCostFromInput = costType === "per_person" ? numericCost * participantCount : numericCost;

  // Stage 2 actual cost
  const numericActualCost = parseFloat(actualCost) || totalCostFromInput;

  const participantArray = travelers.filter((t) => participants.has(t.id));

  const toggleParticipant = (id: string) => {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmOnly = () => {
    if (!block) return;
    onConfirm(dayIndex, block.id, {
      title: title.trim() || block.title,
      cost: numericCost || block.cost,
      costType,
      status: "confirmed",
      confirmedDetails: {
        actualCost: totalCostFromInput,
        costType,
        participants: Array.from(participants),
        confirmedAt: new Date().toISOString(),
        expenseCreated: false,
      },
    });
    toast({ title: "Activity confirmed" });
    resetForm();
    onClose();
  };

  const handleGoToExpense = () => {
    setActualCost(String(totalCostFromInput));
    setStage(2);
  };

  const handleLogExpense = async () => {
    if (!block || !onAddExpense) return;
    const expenseAmount = numericActualCost;
    const shares = participantArray.length > 0
      ? (() => {
          const cents = Math.round(expenseAmount * 100);
          const baseShare = Math.floor(cents / participantArray.length);
          const remainder = cents - baseShare * participantArray.length;
          return participantArray.map((t, i) => ({
            travelerId: t.id,
            share: (baseShare + (i < remainder ? 1 : 0)) / 100,
          }));
        })()
      : [];

    try {
      await onAddExpense({
        tripId: "",
        blockId: block.id,
        description: title.trim() || block.title,
        amount: expenseAmount,
        currency: "USD",
        category: BLOCK_TO_EXPENSE_CATEGORY[block.category] || "other",
        date: dayDate,
        paidBy,
        participants: shares,
        splitMethod,
      });

      onConfirm(dayIndex, block.id, {
        title: title.trim() || block.title,
        cost: numericCost || block.cost,
        costType,
        status: "confirmed",
        confirmedDetails: {
          actualCost: expenseAmount,
          costType,
          paidBy,
          participants: Array.from(participants),
          confirmedAt: new Date().toISOString(),
          expenseCreated: true,
        },
      });

      const perPerson = participantArray.length > 0 ? (expenseAmount / participantArray.length).toFixed(2) : expenseAmount.toFixed(2);
      toast({
        title: "Expense logged",
        description: `$${expenseAmount.toFixed(2)} split ${participantArray.length} ways ($${perPerson} each)`,
      });
    } catch {
      toast({ title: "Failed to log expense", variant: "destructive" });
      return;
    }

    resetForm();
    onClose();
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      resetForm();
      onClose();
    }
  };

  if (!block) return null;

  const isExpenseMode = block.status === "confirmed" && block.confirmedDetails && !block.confirmedDetails.expenseCreated;

  const formContent = (
    <div className="space-y-4 px-1">
      {stage === 1 && !isExpenseMode && (
        <>
          {/* Activity name */}
          <div className="space-y-1">
            <label className="text-xs font-body font-medium text-muted-foreground">Activity</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="glass border-white/20 rounded-xl h-9 text-sm"
            />
          </div>

          {/* Cost + type */}
          <div className="space-y-1">
            <label className="text-xs font-body font-medium text-muted-foreground">Cost</label>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 glass rounded-xl px-3 py-1.5 flex-1">
                <DollarSign className="w-4 h-4 text-primary shrink-0" />
                <input
                  type="number"
                  inputMode="decimal"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-sm font-body outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="flex gap-1 glass rounded-xl p-1">
                <button
                  onClick={() => setCostType("total")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-body font-medium transition-all",
                    costType === "total"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Total
                </button>
                <button
                  onClick={() => setCostType("per_person")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-body font-medium transition-all whitespace-nowrap",
                    costType === "per_person"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Per Person
                </button>
              </div>
            </div>
            {costType === "per_person" && participantCount > 0 && numericCost > 0 && (
              <p className="text-xs text-muted-foreground font-body mt-1">
                {participantCount} participants x ${numericCost.toFixed(2)} = ${totalCostFromInput.toFixed(2)} total
              </p>
            )}
          </div>

          {/* Participants */}
          <div className="space-y-1.5">
            <label className="text-xs font-body font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Who's involved
            </label>
            <div className="glass rounded-xl p-2.5 space-y-1">
              {travelers.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={participants.has(t.id)}
                    onCheckedChange={() => toggleParticipant(t.id)}
                  />
                  <span className="text-sm font-body text-foreground">
                    {t.name} {t.isCurrentUser ? "(you)" : ""}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={handleConfirmOnly}
              className="flex-1 rounded-xl glass border-white/20 gap-1.5"
            >
              <Check className="w-4 h-4" /> Confirm Only
            </Button>
            {onAddExpense && tripId && (
              <Button
                onClick={handleGoToExpense}
                className="flex-1 rounded-xl font-display font-semibold gap-1.5"
              >
                <DollarSign className="w-4 h-4" /> Confirm & Log Expense
              </Button>
            )}
          </div>
        </>
      )}

      {(stage === 2 || isExpenseMode) && (
        <>
          <div className="text-center py-1">
            <p className="text-sm font-body text-muted-foreground">
              Log expense for <span className="font-medium text-foreground">"{title || block.title}"</span>
            </p>
          </div>

          {/* Actual cost */}
          <div className="space-y-1">
            <label className="text-xs font-body font-medium text-muted-foreground">Actual Cost (total)</label>
            <div className="flex items-center gap-2 glass rounded-xl px-4 py-2">
              <DollarSign className="w-5 h-5 text-primary shrink-0" />
              <input
                type="number"
                inputMode="decimal"
                value={actualCost || String(totalCostFromInput)}
                onChange={(e) => setActualCost(e.target.value)}
                className="flex-1 bg-transparent text-xl font-display font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm font-body text-muted-foreground">USD</span>
            </div>
            {participantArray.length > 0 && numericActualCost > 0 && (
              <p className="text-xs text-muted-foreground font-body">
                ${(numericActualCost / participantArray.length).toFixed(2)} per person ({participantArray.length} way split)
              </p>
            )}
          </div>

          {/* Who paid */}
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

          {/* Split method */}
          <div className="space-y-1.5">
            <label className="text-xs font-body font-medium text-muted-foreground uppercase tracking-wider">Split method</label>
            <div className="flex gap-1 glass rounded-xl p-1">
              {([
                { value: "equal", label: "Equally" },
                { value: "custom_amount", label: "Custom" },
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

          {/* Log button */}
          <Button
            onClick={handleLogExpense}
            disabled={!paidBy || numericActualCost <= 0}
            className="w-full rounded-xl h-11 font-display font-semibold text-sm gap-1.5"
          >
            <DollarSign className="w-4 h-4" /> Log Expense
          </Button>

          {stage === 2 && (
            <Button
              variant="ghost"
              onClick={() => setStage(1)}
              className="w-full rounded-xl text-xs text-muted-foreground"
            >
              Back to confirmation
            </Button>
          )}
        </>
      )}
    </div>
  );

  const modalTitle = isExpenseMode
    ? "Log Expense"
    : stage === 2
    ? "Log Expense"
    : "Confirm Activity";

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="glass-card-readable border-white/15 max-h-[85vh] flex flex-col">
          <DrawerHeader>
            <DrawerTitle className="font-display text-lg">{modalTitle}</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass-card-readable border-white/15 sm:max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="font-display text-lg">{modalTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-3">
          {formContent}
        </div>
      </DialogContent>
    </Dialog>
  );
}
