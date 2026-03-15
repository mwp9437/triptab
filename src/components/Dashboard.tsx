import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays, MapPin, Clock, DollarSign, Check, Plane, Hotel,
  UtensilsCrossed, Ticket, Backpack, ArrowLeft, Bus, Palmtree,
  Coffee, Bed, Plus, Download, Trash2, Luggage, Shirt, Plug, FileText, ShowerHead, Package, Globe,
  Shuffle, Save, LogOut, FolderOpen, UserCheck, UserX, Wallet, CircleDollarSign, Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import EditablePrice from "@/components/EditablePrice";
import InviteModal from "@/components/InviteModal";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

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
import AccommodationHub, { AccommodationDetails, BedroomAssignment } from "./AccommodationHub";
import DatePoll, { DatePollData } from "./DatePoll";
import AddActivityModal, { Suggestion } from "./AddActivityModal";
import ConfirmActivityModal from "./ConfirmActivityModal";
import FeedbackModal from "./FeedbackModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Expense, Traveler } from "@/types/expenses";
import type { ExpenseInitialValues } from "./expenses/AddExpenseModal";
import luxuryResort from "@/assets/luxury-resort.png";
import { cn } from "@/lib/utils";

/** Curated Unsplash photo IDs — permanent URLs, no API key needed */
const DESTINATION_PHOTOS: Record<string, string> = {
  "cancun": "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1920&h=1080&fit=crop",
  "hawaii": "https://images.unsplash.com/photo-1507876466758-bc54f384809c?w=1920&h=1080&fit=crop",
  "bali": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1920&h=1080&fit=crop",
  "maldives": "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1920&h=1080&fit=crop",
  "phuket": "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=1920&h=1080&fit=crop",
  "banff": "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=1920&h=1080&fit=crop",
  "switzerland": "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&h=1080&fit=crop",
  "colorado": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&h=1080&fit=crop",
  "denver": "https://images.unsplash.com/photo-1546156929-a4c0ac411f47?w=1920&h=1080&fit=crop",
  "paris": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920&h=1080&fit=crop",
  "rome": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1920&h=1080&fit=crop",
  "florence": "https://images.unsplash.com/photo-1543429258-0f2b960ebaca?w=1920&h=1080&fit=crop",
  "venice": "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=1920&h=1080&fit=crop",
  "amalfi": "https://images.unsplash.com/photo-1534113414509-0eec2bfb493f?w=1920&h=1080&fit=crop",
  "barcelona": "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1920&h=1080&fit=crop",
  "madrid": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1920&h=1080&fit=crop",
  "london": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1920&h=1080&fit=crop",
  "edinburgh": "https://images.unsplash.com/photo-1506377585622-bedcbb027afc?w=1920&h=1080&fit=crop",
  "amsterdam": "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1920&h=1080&fit=crop",
  "santorini": "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1920&h=1080&fit=crop",
  "athens": "https://images.unsplash.com/photo-1555993539-1732b0258235?w=1920&h=1080&fit=crop",
  "lisbon": "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1920&h=1080&fit=crop",
  "berlin": "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=1920&h=1080&fit=crop",
  "munich": "https://images.unsplash.com/photo-1595867818082-083862f3d630?w=1920&h=1080&fit=crop",
  "dubai": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1920&h=1080&fit=crop",
  "istanbul": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1920&h=1080&fit=crop",
  "tokyo": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920&h=1080&fit=crop",
  "kyoto": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1920&h=1080&fit=crop",
  "osaka": "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=1920&h=1080&fit=crop",
  "bangkok": "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1920&h=1080&fit=crop",
  "singapore": "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1920&h=1080&fit=crop",
  "hong kong": "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=1920&h=1080&fit=crop",
  "seoul": "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=1920&h=1080&fit=crop",
  "new york": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1920&h=1080&fit=crop",
  "los angeles": "https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=1920&h=1080&fit=crop",
  "san francisco": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1920&h=1080&fit=crop",
  "miami": "https://images.unsplash.com/photo-1514214246283-d427a95c5d2f?w=1920&h=1080&fit=crop",
  "chicago": "https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=1920&h=1080&fit=crop",
  "seattle": "https://images.unsplash.com/photo-1502175353174-a7a70e73b4c3?w=1920&h=1080&fit=crop",
  "mexico": "https://images.unsplash.com/photo-1518638150340-f706e86654de?w=1920&h=1080&fit=crop",
  "rio": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1920&h=1080&fit=crop",
  "sydney": "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1920&h=1080&fit=crop",
  "melbourne": "https://images.unsplash.com/photo-1514395462725-fb4566210144?w=1920&h=1080&fit=crop",
  "japan": "https://images.unsplash.com/photo-1528164344705-47542687000d?w=1920&h=1080&fit=crop",
  "italy": "https://images.unsplash.com/photo-1534113414509-0eec2bfb493f?w=1920&h=1080&fit=crop",
  "spain": "https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=1920&h=1080&fit=crop",
  "france": "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1920&h=1080&fit=crop",
  "greece": "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1920&h=1080&fit=crop",
};

const FALLBACK_PHOTOS = [
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&h=1080&fit=crop",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&h=1080&fit=crop",
];

function getDestinationImageUrl(destination: string): string {
  const lower = destination.toLowerCase();
  for (const [key, url] of Object.entries(DESTINATION_PHOTOS)) {
    if (lower.includes(key)) return url;
  }
  const hash = lower.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACK_PHOTOS[hash % FALLBACK_PHOTOS.length];
}

/** Hook: resolve a destination background with fallback */
function useDestinationBackground(destination: string, fallback: string) {
  const [bgUrl, setBgUrl] = useState<string>(fallback);

  useEffect(() => {
    const url = getDestinationImageUrl(destination);
    const img = new window.Image();
    img.onload = () => setBgUrl(url);
    img.onerror = () => setBgUrl(fallback);
    img.src = url;
  }, [destination, fallback]);

  return { bgUrl };
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

/** Suggested time slots for empty/sparse days */
type TimeSlot = { label: string; startTime: string; endTime: string; category: BlockCategory };

const MAX_SUGGESTIONS_PER_DAY = 4;

const STANDARD_SLOTS: TimeSlot[] = [
  { label: "Morning Activity", startTime: "09:00", endTime: "12:00", category: "activity" },
  { label: "Lunch", startTime: "12:00", endTime: "13:30", category: "meal" },
  { label: "Afternoon Activity", startTime: "14:00", endTime: "17:00", category: "activity" },
  { label: "Dinner", startTime: "19:00", endTime: "21:00", category: "meal" },
];

function getSmartSuggestions(blocks: TimeBlock[]): TimeSlot[] {
  const nonAccom = blocks.filter(b => b.category !== "accommodation");
  const confirmedCount = nonAccom.filter(b => b.status === "confirmed").length;

  // If the user has 4+ confirmed activities, only nudge for major gaps
  if (confirmedCount >= 4) {
    const gaps: TimeSlot[] = [];
    const hasEvening = nonAccom.some(b => b.startTime >= "17:00");
    const hasLunch = nonAccom.some(b => b.startTime >= "11:30" && b.startTime < "14:00" && /meal|lunch|food/i.test(b.category + b.title));
    if (!hasEvening) gaps.push({ label: "Evening Plans", startTime: "18:00", endTime: "21:00", category: "activity" });
    if (!hasLunch) gaps.push({ label: "Lunch", startTime: "12:00", endTime: "13:30", category: "meal" });
    return gaps.slice(0, 1);
  }

  const suggestionsToShow = Math.max(0, MAX_SUGGESTIONS_PER_DAY - confirmedCount);
  if (suggestionsToShow === 0) return [];

  const missing = STANDARD_SLOTS.filter(slot =>
    !nonAccom.some(b => b.startTime < slot.endTime && b.endTime > slot.startTime)
  );

  return missing.slice(0, suggestionsToShow);
}

// Legacy alias
function getMissingSlots(blocks: TimeBlock[]): TimeSlot[] {
  return getSmartSuggestions(blocks);
}

interface DashboardProps {
  plan: TripPlan;
  conversationHistory: { role: string; content: string }[];
  onBack: () => void;
  
  onAddActivity?: (dayIndex: number, block?: TimeBlock) => void;
  onDeleteBlock?: (dayIndex: number, blockId: string) => void;
  onSwapBlock?: (original: TimeBlock, replacement: BlockAlternative) => void;
  onUpdateBlockCost?: (dayIndex: number, blockId: string, cost: number) => void;
  onUpdateBlock?: (dayIndex: number, blockId: string, updates: Partial<TimeBlock>) => void;
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
  personalBudget?: number | null;
  onSetPersonalBudget?: (budget: number | null) => void;
  travelerSlot?: React.ReactNode;
  // Expense props
  expenses?: Expense[];
  travelers?: Traveler[];
  onAddExpense?: (expense: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  onDeleteExpense?: (id: string) => Promise<void>;
  onUpdateExpense?: (id: string, updates: Partial<Omit<Expense, "id" | "tripId" | "createdAt">>) => Promise<void>;
  onOpenTravelers?: () => void;
  defaultTab?: "schedule" | "details" | "expenses";
  // Accommodation props
  accommodationDetails?: AccommodationDetails;
  bedroomAssignments?: BedroomAssignment[];
  onUpdateAccommodation?: (details: AccommodationDetails, bedrooms: BedroomAssignment[]) => void;
  isOwner?: boolean;
  // Date poll props
  datePoll?: DatePollData;
  onUpdateDatePoll?: (poll: DatePollData) => void;
  onLockDates?: (startDate: string, endDate: string) => void;
  currentTravelerId?: string;
  // Pre-fetched AI suggestions for empty slots
  slotSuggestions?: Record<string, Suggestion[]>;
  slotSuggestionsLoading?: boolean;
}

export default function Dashboard({
  plan,
  conversationHistory,
  onBack,
  onAddActivity,
  onDeleteBlock,
  onSwapBlock,
  onUpdateBlockCost,
  onUpdateBlock,
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
  personalBudget,
  onSetPersonalBudget,
  travelerSlot,
  expenses = [],
  travelers = [],
  onAddExpense,
  onDeleteExpense,
  onUpdateExpense,
  onOpenTravelers,
  defaultTab,
  accommodationDetails,
  bedroomAssignments,
  onUpdateAccommodation,
  isOwner,
  datePoll,
  onUpdateDatePoll,
  onLockDates,
  currentTravelerId,
  slotSuggestions,
  slotSuggestionsLoading,
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

  // Add activity modal state
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [addActivityDayIndex, setAddActivityDayIndex] = useState(0);
  const [addActivitySlot, setAddActivitySlot] = useState<TimeSlot | undefined>(undefined);

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

  const openAddActivity = (dayIndex: number, slot?: TimeSlot) => {
    setAddActivityDayIndex(dayIndex);
    setAddActivitySlot(slot);
    setAddActivityOpen(true);
  };

  // Confirm activity modal state
  const [confirmBlock, setConfirmBlock] = useState<TimeBlock | null>(null);
  const [confirmDayIndex, setConfirmDayIndex] = useState(0);
  const [confirmDayDate, setConfirmDayDate] = useState("");

  const openConfirmModal = (block: TimeBlock, dayIndex: number, dayDate: string) => {
    setConfirmBlock(block);
    setConfirmDayIndex(dayIndex);
    setConfirmDayDate(dayDate);
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
            {onUpdateAccommodation && (
              <AccommodationHub
                accommodationDetails={accommodationDetails}
                bedroomAssignments={bedroomAssignments}
                onUpdate={onUpdateAccommodation}
                canEdit={!!isOwner}
                travelers={travelers}
              />
            )}
            {onUpdateDatePoll && onLockDates && (
              <DatePoll
                datePoll={datePoll}
                onUpdate={onUpdateDatePoll}
                onLock={onLockDates}
                isOwner={!!isOwner}
                currentTravelerId={currentTravelerId}
                travelers={travelers}
              />
            )}
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
            <FeedbackModal tripId={tripId} />
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
                      <div className="flex items-center gap-3 text-left flex-1">
                        <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center">
                          <span className="font-display font-bold text-primary text-sm">{day.dayNumber}</span>
                        </div>
                        <div className="flex-1">
                          <span className="font-display font-semibold text-foreground">{day.title}</span>
                          <p className="text-[10px] text-muted-foreground font-body tracking-luxury uppercase">{day.date}</p>
                        </div>
                        {onAddActivity && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openAddActivity(idx); }}
                            className="w-9 h-9 rounded-full glass border border-white/20 flex items-center justify-center hover:bg-primary/15 hover:text-primary transition-all text-muted-foreground shrink-0 mr-2"
                            title="Add activity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
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
                            const isSuggested = block.status === "suggested" || (!block.status && !block.isUserPrice);
                            const isConfirmed = block.status === "confirmed";
                            const hasExpense = block.confirmedDetails?.expenseCreated || expenseBlockIds.has(block.id);

                            return (
                              <motion.div
                                key={block.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={cn(
                                  "glass-card-solid rounded-2xl group relative cursor-pointer hover:shadow-lg transition-all mb-2 flex flex-col justify-center",
                                  isSuggested
                                    ? "border-l-4 border-dashed border-l-muted-foreground/30 !bg-white/10"
                                    : style.colorClass,
                                  !optedIn && "opacity-50"
                                )}
                                style={{ minHeight: `${minHeight}px` }}
                                onClick={() => setSelectedBlock(block)}
                              >
                                {/* Confirmed checkmark badge */}
                                {isConfirmed && (
                                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-green-500/20 text-green-600 flex items-center justify-center z-10" title="Confirmed">
                                    <Check className="w-3 h-3" />
                                  </span>
                                )}
                                {/* Expense badge */}
                                {hasExpense && (
                                  <span className={cn("absolute w-5 h-5 rounded-full bg-sage/20 text-sage flex items-center justify-center text-[10px] font-bold z-10", isConfirmed ? "top-1.5 right-7" : "top-1.5 right-1.5")} title="Has expense logged">$</span>
                                )}
                                <div className="p-3.5">
                                  {/* Top row: icon + title + meta | price + actions */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                      {isSuggested ? (
                                        <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-primary/50" />
                                      ) : (
                                        <Icon className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
                                      )}
                                      <div className="min-w-0">
                                        <p className={cn("font-body text-sm truncate", isSuggested ? "italic text-muted-foreground" : "font-medium")}>{block.title}</p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                          <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {block.startTime}–{block.endTime}
                                          </span>
                                          {block.location && (
                                            <span className="flex items-center gap-1 truncate">
                                              <MapPin className="w-3 h-3 shrink-0" />
                                              <span className="truncate">{block.location}</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {/* Price display */}
                                      {isSuggested ? (
                                        block.cost != null && block.cost > 0 && (
                                          <span className="text-xs text-muted-foreground/70 font-body whitespace-nowrap">
                                            ~${block.cost} est.
                                            {block.costType === "per_person" ? " /pp" : ""}
                                          </span>
                                        )
                                      ) : (
                                        <EditablePrice
                                          cost={block.confirmedDetails?.actualCost ?? block.cost}
                                          isUserPrice={block.isUserPrice || isConfirmed}
                                          onUpdate={(c) => onUpdateBlockCost?.(idx, block.id, c)}
                                        />
                                      )}
                                      {onDeleteBlock && (
                                        <TooltipProvider delayDuration={300}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); onDeleteBlock(idx, block.id); }}
                                                className="opacity-60 sm:opacity-30 group-hover:opacity-100 transition-opacity ml-1 p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top"><p>Remove</p></TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </div>
                                  </div>
                                  {/* Notes row */}
                                  {block.notes && (
                                    <p className="text-xs text-muted-foreground mt-1.5 ml-[26px] font-body line-clamp-2 pr-2">{block.notes}</p>
                                  )}
                                  {/* Bottom row: action buttons in normal flow (not absolute) */}
                                  {(isSuggested || (isConfirmed && !hasExpense)) && (
                                    <div className="flex items-center justify-between mt-2 ml-[26px]">
                                      {/* Left: Confirm / Log expense */}
                                      {isSuggested && onUpdateBlock && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); openConfirmModal(block, idx, day.date); }}
                                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/15 text-primary text-xs font-body font-medium hover:bg-primary/25 active:bg-primary/25 transition-colors"
                                        >
                                          <Check className="w-3 h-3" /> Confirm
                                        </button>
                                      )}
                                      {isConfirmed && !hasExpense && onAddExpense && tripId && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); openConfirmModal(block, idx, day.date); }}
                                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sage/15 text-sage text-xs font-body font-medium hover:bg-sage/25 active:bg-sage/25 transition-colors"
                                        >
                                          <CircleDollarSign className="w-3 h-3" /> Log expense
                                        </button>
                                      )}
                                      {/* Right: Remix */}
                                      <TooltipProvider delayDuration={300}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setRemixBlock(block); }}
                                              className="p-1.5 rounded-xl glass hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                            >
                                              <Shuffle className="w-3.5 h-3.5" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top"><p>Find alternatives</p></TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  )}
                                  {/* Remix-only row for confirmed blocks with expense */}
                                  {isConfirmed && hasExpense && (
                                    <div className="flex items-center justify-end mt-1">
                                      <TooltipProvider delayDuration={300}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setRemixBlock(block); }}
                                              className="opacity-60 sm:opacity-30 group-hover:opacity-100 transition-opacity p-1.5 rounded-xl glass hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                            >
                                              <Shuffle className="w-3.5 h-3.5" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top"><p>Find alternatives</p></TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  )}
                                  {/* Remix for blocks without confirm/expense buttons */}
                                  {!isSuggested && !isConfirmed && (
                                    <div className="flex items-center justify-end mt-1">
                                      <TooltipProvider delayDuration={300}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setRemixBlock(block); }}
                                              className="opacity-60 sm:opacity-30 group-hover:opacity-100 transition-opacity p-1.5 rounded-xl glass hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                            >
                                              <Shuffle className="w-3.5 h-3.5" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top"><p>Find alternatives</p></TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>

                        {/* Placeholder suggestion bubbles for missing time slots */}
                        {onAddActivity && (() => {
                          const missing = getSmartSuggestions(day.blocks);
                          return missing.map((slot) => {
                            const SlotIcon = BLOCK_STYLES[slot.category]?.icon || Palmtree;
                            const slotKey = `${idx}-${slot.label}`;
                            const sug = slotSuggestions?.[slotKey]?.[0];
                            const isLoading = slotSuggestionsLoading;
                            const displayTitle = sug?.title || slot.label;
                            const displaySub = sug ? (sug.cost != null ? `~$${sug.cost} est.` : sug.description?.slice(0, 50)) : undefined;

                            return (
                              <div
                                key={slot.label}
                                className="w-full rounded-2xl border-2 border-dashed border-white/20 bg-white/5 p-3.5 mb-2"
                              >
                                <div className="flex items-start gap-2.5">
                                  <SlotIcon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                                  <div className="flex-1 min-w-0">
                                    {isLoading ? (
                                      <div className="space-y-1.5">
                                        <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
                                        <div className="h-3 w-1/2 rounded bg-white/5 animate-pulse" />
                                      </div>
                                    ) : (
                                      <>
                                        <p className="font-body text-sm italic text-muted-foreground/70 truncate">
                                          {displayTitle}
                                        </p>
                                        <p className="text-xs text-muted-foreground/40 flex items-center gap-1 mt-0.5">
                                          <Clock className="w-3 h-3" />{slot.startTime}–{slot.endTime}
                                          {displaySub && <span className="ml-1 truncate">{displaySub}</span>}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                  <Sparkles className="w-3.5 h-3.5 text-primary/30 mt-0.5 shrink-0" />
                                </div>
                                {/* Two clear action buttons */}
                                {!isLoading && (
                                  <div className="flex gap-2 mt-2.5 ml-[26px]">
                                    <button
                                      onClick={() => {
                                        if (sug) {
                                          // Add suggestion as suggested block, then open confirm
                                          const newBlock: TimeBlock = {
                                            id: crypto.randomUUID(),
                                            title: sug.title,
                                            startTime: slot.startTime,
                                            endTime: slot.endTime,
                                            category: (sug.category as BlockCategory) || slot.category,
                                            location: sug.location,
                                            cost: sug.cost,
                                            notes: sug.description,
                                            status: "suggested",
                                          };
                                          onAddActivity(idx, newBlock);
                                        } else {
                                          openAddActivity(idx, slot);
                                        }
                                      }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-body font-medium hover:bg-primary/25 active:bg-primary/25 transition-colors"
                                    >
                                      <Plus className="w-3 h-3" /> Add to itinerary
                                    </button>
                                    <button
                                      onClick={() => openAddActivity(idx, slot)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-muted-foreground text-xs font-body hover:text-foreground hover:bg-white/10 active:bg-white/10 transition-colors"
                                    >
                                      <Shuffle className="w-3 h-3" /> See alternatives
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}

                        {onAddActivity && (
                          <button
                            onClick={() => openAddActivity(idx)}
                            className="w-full rounded-2xl border-2 border-dashed border-white/20 hover:border-primary/40 p-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-body my-2"
                          >
                            <Plus className="w-4 h-4" /> Add Activity
                          </button>
                        )}

                        {!onAddActivity && regularBlocks.length === 0 && (
                          <p className="text-sm text-muted-foreground font-body py-3 text-center">No activities planned yet.</p>
                        )}

                        {/* Lodging placeholder if no accommodation block */}
                        {accommodationBlocks.length === 0 && onAddActivity && (
                          <button
                            onClick={() => openAddActivity(idx, { label: "Lodging", startTime: "21:00", endTime: "23:59", category: "accommodation" as BlockCategory })}
                            className="w-full mt-2 pt-2 border-t border-border/30 rounded-2xl border-2 border-dashed border-white/20 hover:border-primary/30 bg-white/5 hover:bg-white/10 p-3 flex items-center gap-2.5 text-left transition-all group/ph"
                          >
                            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Bed className="w-4 h-4 text-muted-foreground/50" />
                            </div>
                            <p className="font-body text-sm italic text-muted-foreground/70 group-hover/ph:text-muted-foreground transition-colors">
                              Add lodging
                            </p>
                            <Sparkles className="w-3.5 h-3.5 text-primary/30 group-hover/ph:text-primary/60 transition-colors ml-auto shrink-0" />
                          </button>
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

                          const accomSuggested = block.status === "suggested" || (!block.status && !block.isUserPrice);
                          const accomConfirmed = block.status === "confirmed";
                          const accomHasExpense = block.confirmedDetails?.expenseCreated || expenseBlockIds.has(block.id);

                          return (
                          <motion.div
                            key={block.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-2 pt-2 border-t border-border/30 cursor-pointer group relative"
                            onClick={() => setSelectedBlock(block)}
                          >
                            <div className={cn(
                              "glass rounded-2xl p-3 flex items-center justify-between",
                              accomSuggested
                                ? "border-l-4 border-dashed border-l-muted-foreground/30"
                                : BLOCK_STYLES.accommodation.colorClass
                            )}>
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                  {accomSuggested ? <Sparkles className="w-4 h-4 text-primary/50" /> : <Bed className="w-4 h-4 text-primary" />}
                                </div>
                                <div>
                                  <p className={cn("font-body text-sm", accomSuggested ? "italic text-muted-foreground" : "font-medium text-foreground")}>{displayTitle}</p>
                                  {block.location && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <MapPin className="w-3 h-3" /> {block.location}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {accomSuggested ? (
                                  block.cost != null && block.cost > 0 && (
                                    <span className="text-xs text-muted-foreground/70 font-body">~${block.cost} est./night</span>
                                  )
                                ) : (
                                  <EditablePrice
                                    cost={block.confirmedDetails?.actualCost ?? block.cost}
                                    isUserPrice={block.isUserPrice || accomConfirmed}
                                    suffix="/night"
                                    onUpdate={(c) => onUpdateBlockCost?.(idx, block.id, c)}
                                  />
                                )}
                                {accomConfirmed && (
                                  <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-600 flex items-center justify-center" title="Confirmed">
                                    <Check className="w-3 h-3" />
                                  </span>
                                )}
                                {accomHasExpense && (
                                  <span className="w-5 h-5 rounded-full bg-sage/20 text-sage flex items-center justify-center text-[10px] font-bold" title="Has expense">$</span>
                                )}
                                {accomSuggested && onUpdateBlock && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openConfirmModal(block, idx, day.date); }}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/15 text-primary text-xs font-body font-medium hover:bg-primary/25 transition-colors"
                                  >
                                    <Check className="w-3 h-3" /> Confirm
                                  </button>
                                )}
                                {onDeleteBlock && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteBlock(idx, block.id); }}
                                    className="opacity-60 sm:opacity-30 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); setRemixBlock(block); }}
                                  className="opacity-60 sm:opacity-30 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary"
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
                  onUpdateExpense={onUpdateExpense}
                  onSave={onSave}
                  onOpenTravelers={onOpenTravelers}
                  initialValues={quickAddValues}
                  onClearInitialValues={() => setQuickAddValues(undefined)}
                  personalBudget={personalBudget}
                  onSetPersonalBudget={onSetPersonalBudget}
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
                  onUpdateExpense={onUpdateExpense}
                  onSave={onSave}
                  onOpenTravelers={onOpenTravelers}
                  initialValues={quickAddValues}
                  onClearInitialValues={() => setQuickAddValues(undefined)}
                  personalBudget={personalBudget}
                  onSetPersonalBudget={onSetPersonalBudget}
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

        {onAddActivity && (
          <AddActivityModal
            open={addActivityOpen}
            onClose={() => { setAddActivityOpen(false); setAddActivitySlot(undefined); }}
            onAdd={(block) => onAddActivity(addActivityDayIndex, block)}
            dayDate={plan.itinerary[addActivityDayIndex]?.date || ""}
            dayNumber={plan.itinerary[addActivityDayIndex]?.dayNumber || 1}
            tripContext={tripContext}
            slotLabel={addActivitySlot?.label}
            slotStartTime={addActivitySlot?.startTime}
            slotEndTime={addActivitySlot?.endTime}
            slotCategory={addActivitySlot?.category}
            preloadedSuggestions={addActivitySlot ? slotSuggestions?.[`${addActivityDayIndex}-${addActivitySlot.label}`] : undefined}
          />
        )}

        {onUpdateBlock && (
          <ConfirmActivityModal
            open={!!confirmBlock}
            onClose={() => setConfirmBlock(null)}
            block={confirmBlock}
            dayDate={confirmDayDate}
            dayIndex={confirmDayIndex}
            travelers={travelers}
            onConfirm={onUpdateBlock}
            onAddExpense={onAddExpense}
            tripId={tripId}
            expenses={expenses}
          />
        )}
      </div>
    </div>
  );
}
