import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays, MapPin, Clock, DollarSign, Check, Plane, Hotel,
  UtensilsCrossed, Ticket, Backpack, ArrowLeft, Bus, Palmtree,
  Coffee, Bed, Plus, Download, Trash2, Luggage, Shirt, Plug, FileText, ShowerHead, Package, Globe,
  Shuffle, Save, LogOut, FolderOpen, UserCheck, UserX, Wallet, CircleDollarSign,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import EditablePrice from "@/components/EditablePrice";
import InviteModal from "@/components/InviteModal";
import MyBudgetPanel from "@/components/MyBudgetPanel";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { TripPlan, TimeBlock, ActionItem, BlockCategory, ActionCategory, PackingItem, PackingCategory, LocalTip } from "@/types/itinerary";
import { BlockAlternative } from "@/lib/chat";
import { downloadICS, generateExpensePrintHTML } from "@/lib/calendar-export";
import FloatingChat from "./FloatingChat";
import BlockDetailModal from "./BlockDetailModal";
import RemixModal from "./RemixModal";
import ExpensesPanel from "./expenses/ExpensesPanel";
import { Expense, Traveler } from "@/types/expenses";
import type { ExpenseInitialValues } from "./expenses/AddExpenseModal";
import luxuryResort from "@/assets/luxury-resort.png";
import { cn } from "@/lib/utils";

/** Build Unsplash embed URLs for destination-themed luxury backgrounds */
function getDestinationImageUrl(destination: string): string {
  const q = encodeURIComponent(destination.trim() + " luxury travel");
  return `https://source.unsplash.com/1920x1080/?${q}`;
}

/** Hook: resolve a high-quality destination background with fallback */
function useDestinationBackground(destination: string, fallback: string) {
  const [bgUrl, setBgUrl] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const primary = getDestinationImageUrl(destination);
    const img = new Image();
    img.onload = () => { setBgUrl(primary); setLoaded(true); };
    img.onerror = () => { setBgUrl(fallback); setLoaded(true); };
    img.src = primary;
    // Start showing fallback immediately while loading
    setBgUrl(fallback);
  }, [destination, fallback]);

  return { bgUrl, loaded };
}

const PACKING_ICONS: Record<PackingCategory, typeof Plane> = {
  clothing: Shirt,
  gear: Backpack,
  toiletries: ShowerHead,
  electronics: Plug,
  documents: FileText,
  misc: Package,
};

const BLOCK_STYLES: Record<BlockCategory, { icon: typeof Plane; colorClass: string }> = {
  transport: { icon: Bus, colorClass: "border-l-4 border-l-indigo" },
  activity: { icon: Palmtree, colorClass: "border-l-4 border-l-rose" },
  meal: { icon: Coffee, colorClass: "border-l-4 border-l-gold" },
  free: { icon: Palmtree, colorClass: "border-l-4 border-l-sage" },
  accommodation: { icon: Bed, colorClass: "border-l-4 border-l-stone-dark" },
};

const ACTION_ICONS: Record<ActionCategory, typeof Plane> = {
  flights: Plane,
  hotels: Hotel,
  restaurants: UtensilsCrossed,
  tickets: Ticket,
  packing: Backpack,
};

/** Calculate duration in minutes from time strings */
function getDurationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(diff, 30); // minimum 30 min
}

/** Deduplicate transport blocks — keep only the main flight/ride, remove "arrive at airport" etc. */
function deduplicateBlocks(blocks: TimeBlock[]): TimeBlock[] {
  const transportBlocks = blocks.filter(b => b.category === "transport");
  const accommodationBlocks = blocks.filter(b => b.category === "accommodation");
  const otherBlocks = blocks.filter(b => b.category !== "transport" && b.category !== "accommodation");
  
  // Deduplicate transport: remove "go to airport" if a flight exists
  const skipPatterns = /\b(arrive at|go to|head to|drive to|taxi to|uber to|get to|transfer to)\b.*\b(airport|terminal|station|port)\b/i;
  const flightPattern = /\b(flight|fly|plane|depart|departure|landing|arrive)\b/i;
  const keptTransport: TimeBlock[] = [];
  for (const block of transportBlocks) {
    if (skipPatterns.test(block.title)) {
      const hasRelatedFlight = transportBlocks.some(
        other => other.id !== block.id && flightPattern.test(other.title)
      );
      if (hasRelatedFlight) continue;
    }
    keptTransport.push(block);
  }

  // Deduplicate accommodation: keep one per unique name (normalized)
  const seenAccommodations = new Map<string, TimeBlock>();
  for (const block of accommodationBlocks) {
    // Strip all common prefixes the AI generates
    const key = block.title
      .toLowerCase()
      .replace(/^(check[- ]?in[:\s]*|check[- ]?out[:\s]*|accommodation[:\s]*)/i, "")
      .replace(/@\s*[\d:]+\s*(am|pm)?/i, "")
      .replace(/\b(at|in)\s+(hotel\s+in\s+)?/i, "")
      .replace(/\s+/g, " ")
      .trim();
    
    const locationKey = block.location?.toLowerCase().trim() || "";
    
    let isDuplicate = false;
    for (const [existingKey, existingBlock] of seenAccommodations) {
      if (key.includes(existingKey) || existingKey.includes(key)) {
        isDuplicate = true;
        if ((block.cost && !existingBlock.cost) || block.title.length > existingBlock.title.length) {
          seenAccommodations.set(existingKey, block);
        }
        break;
      }
      if (locationKey && existingBlock.location?.toLowerCase().trim() === locationKey) {
        isDuplicate = true;
        if ((block.cost && !existingBlock.cost) || block.title.length > existingBlock.title.length) {
          seenAccommodations.set(existingKey, block);
        }
        break;
      }
    }
    
    if (!isDuplicate) {
      seenAccommodations.set(key, block);
    }
  }

  return [...otherBlocks, ...keptTransport, ...Array.from(seenAccommodations.values())];
}

interface DashboardProps {
  plan: TripPlan;
  conversationHistory: { role: string; content: string }[];
  onBack: () => void;
  
  onAddActivity?: (dayIndex: number) => void;
  onDeleteBlock?: (dayIndex: number, blockId: string) => void;
  onSwapBlock?: (original: TimeBlock, replacement: BlockAlternative) => void;
  onUpdateBlockCost?: (dayIndex: number, blockId: string, cost: number) => void;
  tripContext?: string;
  hideActionsSidebar?: boolean;
  hideFloatingChat?: boolean;
  onSave?: () => void;
  saving?: boolean;
  tripId?: string | null;
  isOptedIn?: (blockId: string) => boolean;
  onToggleOptIn?: (blockId: string) => void;
  budgetCap?: number | null;
  onSetBudgetCap?: (cap: number | null) => void;
  travelerSlot?: React.ReactNode;
  // Expense props
  expenses?: Expense[];
  travelers?: Traveler[];
  onAddExpense?: (expense: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  onDeleteExpense?: (id: string) => Promise<void>;
  onOpenTravelers?: () => void;
  defaultTab?: "schedule" | "details" | "expenses";
}

export default function Dashboard({
  plan,
  conversationHistory,
  onBack,
  onAddActivity,
  onDeleteBlock,
  onSwapBlock,
  onUpdateBlockCost,
  tripContext,
  hideActionsSidebar,
  hideFloatingChat,
  onSave,
  saving,
  tripId,
  isOptedIn,
  onToggleOptIn,
  budgetCap,
  onSetBudgetCap,
  travelerSlot,
  expenses = [],
  travelers = [],
  onAddExpense,
  onDeleteExpense,
  onOpenTravelers,
  defaultTab,
}: DashboardProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [actionItems, setActionItems] = useState<ActionItem[]>(plan.actionItems);
  const [packingList, setPackingList] = useState<PackingItem[]>(plan.packingList || []);
  const [selectedBlock, setSelectedBlock] = useState<TimeBlock | null>(null);
  const [remixBlock, setRemixBlock] = useState<TimeBlock | null>(null);
  const [mobileTab, setMobileTab] = useState<"schedule" | "details" | "expenses">(defaultTab || "schedule");
  const [sidebarView, setSidebarView] = useState<"details" | "expenses">("details");
  const [quickAddValues, setQuickAddValues] = useState<ExpenseInitialValues | undefined>(undefined);

  // Build a set of blockIds that have expenses linked
  const expenseBlockIds = useMemo(
    () => new Set(expenses.filter((e) => e.blockId).map((e) => e.blockId!)),
    [expenses]
  );

  const BLOCK_TO_EXPENSE_CAT: Record<string, Expense["category"]> = {
    activity: "activities",
    meal: "food",
    transport: "transport",
    accommodation: "accommodation",
    free: "other",
  };

  const handleQuickAddExpense = (block: TimeBlock, dayDate: string) => {
    const cat = BLOCK_TO_EXPENSE_CAT[block.category] || "other";
    setQuickAddValues({
      description: block.title,
      category: cat,
      date: new Date(dayDate + "T00:00:00"),
      amount: block.cost || undefined,
      blockId: block.id,
    });
    setSidebarView("expenses");
    // On mobile, switch tab
    setMobileTab("expenses");
  };

  const togglePackingItem = (id: string) => {
    setPackingList((items) =>
      items.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const toggleItem = (id: string) => {
    setActionItems((items) =>
      items.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const completedCount = actionItems.filter((i) => i.completed).length;
  const budgetPercent = plan.budget.total > 0 ? (plan.budget.spent / plan.budget.total) * 100 : 0;

  const groupedActions = actionItems.reduce<Record<string, ActionItem[]>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  const handlePrint = () => {
    // Inject expense summary for print if expenses exist
    if (expenses.length > 0 && travelers.length > 0) {
      const html = generateExpensePrintHTML(expenses, travelers, plan);
      const div = document.createElement("div");
      div.className = "print-expense-summary";
      div.innerHTML = html;
      document.body.appendChild(div);
      window.print();
      document.body.removeChild(div);
    } else {
      window.print();
    }
  };

  const { bgUrl } = useDestinationBackground(plan.destination, luxuryResort);

  return (
    <div className="relative min-h-screen">
      {/* Destination-themed background */}
      <div className="fixed inset-0 z-0">
        <img
          src={bgUrl}
          alt=""
          className="w-full h-full object-cover transition-opacity duration-700"
          onError={(e) => { (e.target as HTMLImageElement).src = luxuryResort; }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/45 to-background/55 backdrop-blur-sm" />
      </div>

      <div className="relative z-10">
        {/* Top bar — glass */}
        <header className="border-b border-white/15 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 glass-card z-40">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 hover:bg-white/20 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-base sm:text-lg text-foreground truncate">{plan.destination}</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-body tracking-wide">
                {plan.startDate} → {plan.endDate} · {plan.travelers} traveler{plan.travelers > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {user && (
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl border-white/20 glass hover:bg-white/30 hidden sm:flex" onClick={() => navigate("/my-trips")}>
                <FolderOpen className="w-4 h-4" /> <span className="hidden md:inline">My Trips</span>
              </Button>
            )}
            {user && (
              <Button variant="outline" size="icon" className="rounded-xl border-white/20 glass hover:bg-white/30 sm:hidden h-8 w-8" onClick={() => navigate("/my-trips")}>
                <FolderOpen className="w-4 h-4" />
              </Button>
            )}
            {tripId && <InviteModal tripId={tripId} />}
            {travelerSlot}
            {onSave && (
              <Button variant="outline" size="icon" className="rounded-xl border-white/20 glass hover:bg-white/30 sm:hidden h-8 w-8" onClick={onSave} disabled={saving}>
                <Save className="w-4 h-4" />
              </Button>
            )}
            {onSave && (
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl border-white/20 glass hover:bg-white/30 hidden sm:flex" onClick={onSave} disabled={saving}>
                <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
              </Button>
            )}
            <Button variant="outline" size="icon" className="rounded-xl border-white/20 glass hover:bg-white/30 sm:hidden h-8 w-8" onClick={handlePrint}>
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl border-white/20 glass hover:bg-white/30 hidden sm:flex" onClick={handlePrint}>
              <Download className="w-4 h-4" /> <span className="hidden md:inline">PDF</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl border-white/20 glass hover:bg-white/30 hidden sm:flex"
              onClick={() => downloadICS(plan, expenses, travelers)}
            >
              <CalendarDays className="w-4 h-4" /> <span className="hidden md:inline">Sync</span>
            </Button>
            <Button variant="outline" size="icon" className="rounded-xl border-white/20 glass hover:bg-white/30 sm:hidden h-8 w-8" onClick={() => downloadICS(plan, expenses, travelers)}>
              <CalendarDays className="w-4 h-4" />
            </Button>
            {user && (
              <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={signOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        </header>

        {/* Content — independent scroll panes */}
        <div className="flex flex-col lg:flex-row" style={{ height: "calc(100vh - 49px)" }}>
          {/* Mobile tab toggle */}
          {!hideActionsSidebar && (
            <div className="flex lg:hidden px-4 pt-3 pb-1 gap-1">
              <button
                onClick={() => setMobileTab("schedule")}
                className={`flex-1 py-2 rounded-xl text-sm font-display font-semibold transition-all ${
                  mobileTab === "schedule"
                    ? "glass-card text-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarDays className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Schedule
              </button>
              <button
                onClick={() => setMobileTab("details")}
                className={`flex-1 py-2 rounded-xl text-sm font-display font-semibold transition-all ${
                  mobileTab === "details"
                    ? "glass-card text-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Check className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Details
                {actionItems.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{completedCount}/{actionItems.length}</span>
                )}
              </button>
              <button
                onClick={() => setMobileTab("expenses")}
                className={`flex-1 py-2 rounded-xl text-sm font-display font-semibold transition-all ${
                  mobileTab === "expenses"
                    ? "glass-card text-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Wallet className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Expenses
                {expenses.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{expenses.length}</span>
                )}
              </button>
            </div>
          )}

          {/* Left: Itinerary */}
          <div className={`flex-1 flex flex-col overflow-hidden ${!hideActionsSidebar ? "lg:border-r border-white/10" : ""} ${mobileTab !== "schedule" ? "hidden lg:flex" : ""}`}>
            {/* Sticky header + day bubbles */}
            <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-0">
              <h2 className="font-display font-bold text-lg sm:text-xl text-foreground mb-3 sm:mb-4 italic">Your Itinerary</h2>
            </div>
            <div className="px-4 sm:px-6 pb-2 sm:pb-3 flex gap-1.5 sm:gap-2 overflow-x-auto sticky top-0 z-30 glass-card border-b border-white/10">
              {plan.itinerary.map((day, idx) => {
                const d = new Date(day.date + "T00:00:00");
                const dayLetter = d.toLocaleDateString("en-US", { weekday: "short" }).charAt(0);
                const dateNum = d.getDate();
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      const el = document.getElementById(`day-section-${idx}`);
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="flex flex-col items-center min-w-[36px] sm:min-w-[40px] px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-2xl glass hover:bg-primary/15 transition-colors group"
                  >
                    <span className="text-[10px] sm:text-xs font-display font-bold text-muted-foreground group-hover:text-primary transition-colors">{dayLetter}</span>
                    <span className="text-xs sm:text-sm font-body font-semibold text-foreground group-hover:text-primary transition-colors">{dateNum}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable itinerary */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
            <Accordion type="multiple" defaultValue={plan.itinerary.map((_, i) => `day-${i}`)}>
              {plan.itinerary.map((day, idx) => {
                const dedupedBlocks = deduplicateBlocks(day.blocks);
                const regularBlocks = dedupedBlocks
                  .filter(b => b.category !== "accommodation")
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                const accommodationBlocks = dedupedBlocks.filter(b => b.category === "accommodation");

                return (
                  <AccordionItem key={idx} value={`day-${idx}`} className="border-white/10" id={`day-section-${idx}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center">
                          <span className="font-display font-bold text-primary text-sm">{day.dayNumber}</span>
                        </div>
                        <div>
                          <span className="font-display font-semibold text-foreground">{day.title}</span>
                          <p className="text-[10px] text-muted-foreground font-body tracking-luxury uppercase">{day.date}</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="ml-[52px] space-y-0">
                        {/* Regular blocks with duration-relative height */}
                        <div className="relative">
                          {/* Timeline line */}
                          <div className="absolute left-4 top-0 bottom-0 w-px bg-border/40" />
                          
                          {regularBlocks.map((block) => {
                            const style = BLOCK_STYLES[block.category];
                            const Icon = style.icon;
                            const duration = getDurationMinutes(block.startTime, block.endTime);
                            const minHeight = Math.min(Math.max(Math.round(duration * 0.6 + 40), 56), 140);
                            const optedIn = isOptedIn ? isOptedIn(block.id) : true;
                            
                            return (
                              <motion.div
                                key={block.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`glass rounded-2xl ${style.colorClass} group relative cursor-pointer hover:shadow-lg transition-all mb-2 flex flex-col justify-center ${!optedIn ? "opacity-50" : ""}`}
                                style={{ minHeight: `${minHeight}px` }}
                                onClick={() => setSelectedBlock(block)}
                              >
                                {expenseBlockIds.has(block.id) && (
                                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-sage/20 text-sage flex items-center justify-center text-[10px] font-bold z-10" title="Has expense logged">$</span>
                                )}
                                <div className="p-3.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2.5">
                                      <Icon className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
                                      <div>
                                        <p className="font-body font-medium text-sm">{block.title}</p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                          <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {block.startTime}–{block.endTime}
                                          </span>
                                          {block.location && (
                                            <span className="flex items-center gap-1">
                                              <MapPin className="w-3 h-3" />
                                              {block.location}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <EditablePrice
                                        cost={block.cost}
                                        isUserPrice={block.isUserPrice}
                                        onUpdate={(c) => onUpdateBlockCost?.(idx, block.id, c)}
                                      />
                                      {onToggleOptIn && tripId && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); onToggleOptIn(block.id); }}
                                          className={`transition-opacity p-1 rounded-lg ${optedIn ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted/30"}`}
                                          title={optedIn ? "Opted in — click to opt out" : "Opted out — click to opt in"}
                                        >
                                          {optedIn ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                                        </button>
                                      )}
                                      {onDeleteBlock && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); onDeleteBlock(idx, block.id); }}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                          title="Remove activity"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {block.notes && (
                                    <p className="text-xs text-muted-foreground mt-1.5 ml-[26px] font-body line-clamp-2">{block.notes}</p>
                                  )}
                                  {/* Quick-add expense */}
                                  {onAddExpense && tripId && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleQuickAddExpense(block, day.date); }}
                                      className="absolute bottom-2 right-10 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-xl glass hover:bg-sage/10 text-muted-foreground hover:text-sage"
                                      title="Log expense"
                                    >
                                      <CircleDollarSign className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {/* Remix button */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setRemixBlock(block); }}
                                    className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-xl glass hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                    title="Find alternatives"
                                  >
                                    <Shuffle className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>

                        {onAddActivity && (
                          <button
                            onClick={() => onAddActivity(idx)}
                            className="w-full rounded-2xl border-2 border-dashed border-white/20 hover:border-primary/40 p-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-body my-2"
                          >
                            <Plus className="w-4 h-4" /> Add Activity
                          </button>
                        )}

                        {!onAddActivity && regularBlocks.length === 0 && (
                          <p className="text-sm text-muted-foreground font-body py-3 text-center">No activities planned yet.</p>
                        )}

                        {/* Accommodation footer */}
                        {accommodationBlocks.map((block) => {
                          // Determine check-in/check-out prefix
                          const allDays = plan.itinerary;
                          const hotelDayIndices = allDays
                            .map((d, i) => d.blocks.some(b => b.category === "accommodation" && b.title === block.title) ? i : -1)
                            .filter(i => i >= 0);
                          const isFirstDay = hotelDayIndices.length > 0 && hotelDayIndices[0] === idx;
                          const isLastDay = hotelDayIndices.length > 0 && hotelDayIndices[hotelDayIndices.length - 1] === idx;

                          const formatTime = (t: string) => {
                            const [h, m] = t.split(":").map(Number);
                            const ampm = h >= 12 ? "PM" : "AM";
                            const hr = h % 12 || 12;
                            return m ? `${hr}:${m.toString().padStart(2, "0")} ${ampm}` : `${hr} ${ampm}`;
                          };

                          let displayTitle = block.title;
                          if (isFirstDay && isLastDay) {
                            displayTitle = `Check in: ${block.title} @ ${formatTime(block.startTime)}`;
                          } else if (isFirstDay) {
                            displayTitle = `Check in: ${block.title} @ ${formatTime(block.startTime)}`;
                          } else if (isLastDay) {
                            displayTitle = `Check out: ${block.title} @ ${formatTime(block.endTime)}`;
                          }

                          return (
                          <motion.div
                            key={block.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-2 pt-2 border-t border-border/30 cursor-pointer group"
                            onClick={() => setSelectedBlock(block)}
                          >
                            <div className={`glass rounded-2xl p-3 flex items-center justify-between ${BLOCK_STYLES.accommodation.colorClass}`}>
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                  <Bed className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-body font-medium text-sm text-foreground">{displayTitle}</p>
                                  {block.location && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <MapPin className="w-3 h-3" /> {block.location}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <EditablePrice
                                  cost={block.cost}
                                  isUserPrice={block.isUserPrice}
                                  suffix="/night"
                                  onUpdate={(c) => onUpdateBlockCost?.(idx, block.id, c)}
                                />
                                {onDeleteBlock && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteBlock(idx, block.id); }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); setRemixBlock(block); }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                  title="Find alternatives"
                                >
                                  <Shuffle className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
            </div>
          </div>

          {/* Right: Actions & Budget — glass cards */}
          {!hideActionsSidebar && (
            <div className={`lg:w-[380px] overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 ${mobileTab === "schedule" ? "hidden lg:block" : mobileTab === "expenses" ? "hidden lg:block" : ""}`}>
              {/* Desktop sidebar toggle */}
              <div className="hidden lg:flex gap-1 glass rounded-xl p-1 mb-2">
                <button
                  onClick={() => setSidebarView("details")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-display font-semibold transition-all",
                    sidebarView === "details"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Plan Details
                </button>
                <button
                  onClick={() => setSidebarView("expenses")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-display font-semibold transition-all",
                    sidebarView === "expenses"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Expenses
                  {expenses.length > 0 && (
                    <span className="ml-1.5 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{expenses.length}</span>
                  )}
                </button>
              </div>

              {sidebarView === "details" && (
                <>
                  {/* Personal budget panel for group trips */}
                  {tripId && isOptedIn && onSetBudgetCap && (
                    <MyBudgetPanel
                      plan={plan}
                      isOptedIn={isOptedIn}
                      budgetCap={budgetCap ?? null}
                      onSetBudgetCap={onSetBudgetCap}
                      tripId={tripId}
                    />
                  )}
                  <Card className="rounded-2xl border-white/15 glass-card-solid shadow-lg">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-display flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-primary" />
                        Budget
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm font-body">
                        <div>
                          <span className="text-muted-foreground">Estimated total</span>
                          <p className="text-[10px] text-muted-foreground/70 font-body">(AI estimates — actual costs may vary)</p>
                        </div>
                        <span className="font-semibold text-foreground">${plan.budget.total.toLocaleString()}</span>
                      </div>
                      <Progress value={budgetPercent} className="h-2" />
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(plan.budget.categories).map(([cat, amount]) => (
                          <div key={cat} className="flex justify-between text-xs font-body text-muted-foreground">
                            <span className="capitalize">{cat}</span>
                            <span>${(amount as number).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border-white/15 glass-card-solid shadow-lg">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-display flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-primary" />
                          Action Items
                        </span>
                        <span className="text-xs font-body text-muted-foreground font-normal">
                          {completedCount}/{actionItems.length}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(groupedActions).map(([category, items]) => {
                        const Icon = ACTION_ICONS[category as ActionCategory] || Ticket;
                        return (
                          <div key={category}>
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-[10px] font-semibold uppercase tracking-luxury text-muted-foreground font-body">
                                {category}
                              </span>
                            </div>
                            <div className="space-y-1.5 ml-5">
                              {items.map((item) => (
                                <label key={item.id} className="flex items-start gap-2 cursor-pointer group">
                                  <Checkbox
                                    checked={item.completed}
                                    onCheckedChange={() => toggleItem(item.id)}
                                    className="mt-0.5"
                                  />
                                  <span className={`text-sm font-body leading-tight ${
                                    item.completed ? "line-through text-muted-foreground" : "text-foreground"
                                  }`}>
                                    {item.text}
                                    {item.cost != null && item.cost > 0 && (
                                      <span className="text-xs text-muted-foreground ml-1">(~${item.cost} est.)</span>
                                    )}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  {/* Packing List */}
                  {packingList.length > 0 && (
                    <Card className="rounded-2xl border-white/15 glass-card-solid shadow-lg">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-display flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Luggage className="w-4 h-4 text-primary" />
                            Packing List
                          </span>
                          <span className="text-xs font-body text-muted-foreground font-normal">
                            {packingList.filter(i => i.checked).length}/{packingList.length}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {Object.entries(
                          packingList.reduce<Record<string, PackingItem[]>>((acc, item) => {
                            (acc[item.category] ||= []).push(item);
                            return acc;
                          }, {})
                        ).map(([category, items]) => {
                          const Icon = PACKING_ICONS[category as PackingCategory] || Package;
                          return (
                            <div key={category}>
                              <div className="flex items-center gap-2 mb-2">
                                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-[10px] font-semibold uppercase tracking-luxury text-muted-foreground font-body">
                                  {category}
                                </span>
                              </div>
                              <div className="space-y-1.5 ml-5">
                                {items.map((item) => (
                                  <label key={item.id} className="flex items-start gap-2 cursor-pointer group">
                                    <Checkbox
                                      checked={item.checked}
                                      onCheckedChange={() => togglePackingItem(item.id)}
                                      className="mt-0.5"
                                    />
                                    <div>
                                      <span className={`text-sm font-body leading-tight ${
                                        item.checked ? "line-through text-muted-foreground" : "text-foreground"
                                      }`}>
                                        {item.text}
                                      </span>
                                      {item.reason && (
                                        <p className="text-xs text-muted-foreground font-body mt-0.5">{item.reason}</p>
                                      )}
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}

                  {/* Local Tips */}
                  {plan.localTips && plan.localTips.length > 0 && (
                    <Card className="rounded-2xl border-white/15 glass-card-solid shadow-lg">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-display flex items-center gap-2">
                          <Globe className="w-4 h-4 text-primary" />
                          Local Tips
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {plan.localTips.map((tip) => (
                          <div key={tip.id} className="flex items-start gap-2.5">
                            <span className="text-lg leading-none mt-0.5">{tip.emoji}</span>
                            <div>
                              <p className="text-sm font-semibold font-body text-foreground">{tip.title}</p>
                              <p className="text-xs text-muted-foreground font-body mt-0.5">{tip.detail}</p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {sidebarView === "expenses" && onAddExpense && onDeleteExpense && (
                <ExpensesPanel
                  expenses={expenses}
                  travelers={travelers}
                  plan={plan}
                  tripId={tripId ?? null}
                  onAddExpense={onAddExpense}
                  onDeleteExpense={onDeleteExpense}
                  onSave={onSave}
                  onOpenTravelers={onOpenTravelers}
                  initialValues={quickAddValues}
                  onClearInitialValues={() => setQuickAddValues(undefined)}
                />
              )}
            </div>
          )}

          {/* Mobile expenses tab */}
          {!hideActionsSidebar && mobileTab === "expenses" && (
            <div className="lg:hidden flex-1 overflow-y-auto p-4">
              {onAddExpense && onDeleteExpense ? (
                <ExpensesPanel
                  expenses={expenses}
                  travelers={travelers}
                  plan={plan}
                  tripId={tripId ?? null}
                  onAddExpense={onAddExpense}
                  onDeleteExpense={onDeleteExpense}
                  onSave={onSave}
                  onOpenTravelers={onOpenTravelers}
                  initialValues={quickAddValues}
                  onClearInitialValues={() => setQuickAddValues(undefined)}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm font-body">
                  Expenses not available
                </div>
              )}
            </div>
          )}
        </div>

        {!hideFloatingChat && <FloatingChat conversationHistory={conversationHistory} currentPlan={plan} onPlanUpdate={() => {}} />}

        <BlockDetailModal
          block={selectedBlock}
          tripContext={tripContext || `${plan.destination}, ${plan.startDate} to ${plan.endDate}, ${plan.travelers} travelers`}
          onClose={() => setSelectedBlock(null)}
        />

        <RemixModal
          block={remixBlock}
          tripContext={tripContext || `${plan.destination}, ${plan.startDate} to ${plan.endDate}, ${plan.travelers} travelers`}
          onClose={() => setRemixBlock(null)}
          onSwap={(original, replacement) => {
            onSwapBlock?.(original, replacement);
            setRemixBlock(null);
          }}
        />
      </div>
    </div>
  );
}
