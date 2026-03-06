import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays, MapPin, Clock, DollarSign, Check, Plane, Hotel,
  UtensilsCrossed, Ticket, Backpack, ArrowLeft, Bus, Palmtree,
  Coffee, Bed, Plus, Download, Trash2, Luggage, Shirt, Plug, FileText, ShowerHead, Package, Globe,
  Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { TripPlan, TimeBlock, ActionItem, BlockCategory, ActionCategory, PackingItem, PackingCategory, LocalTip } from "@/types/itinerary";
import { BlockAlternative } from "@/lib/chat";
import { downloadICS } from "@/lib/calendar-export";
import FloatingChat from "./FloatingChat";
import BlockDetailModal from "./BlockDetailModal";
import RemixModal from "./RemixModal";
import luxuryResort from "@/assets/luxury-resort.png";

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
  const otherBlocks = blocks.filter(b => b.category !== "transport");
  
  // Group overlapping/adjacent transport blocks and keep the most descriptive one
  const keptTransport: TimeBlock[] = [];
  const skipPatterns = /\b(arrive at|go to|head to|drive to|taxi to|uber to|get to|transfer to)\b.*\b(airport|terminal|station|port)\b/i;
  const flightPattern = /\b(flight|fly|plane|depart|departure|landing|arrive)\b/i;
  
  for (const block of transportBlocks) {
    const title = block.title.toLowerCase();
    // Skip blocks that are just "go to airport" type duplicates if there's a flight block
    if (skipPatterns.test(block.title)) {
      const hasRelatedFlight = transportBlocks.some(
        other => other.id !== block.id && flightPattern.test(other.title)
      );
      if (hasRelatedFlight) continue;
    }
    keptTransport.push(block);
  }
  
  return [...otherBlocks, ...keptTransport];
}

interface DashboardProps {
  plan: TripPlan;
  conversationHistory: { role: string; content: string }[];
  onBack: () => void;
  collaborative?: boolean;
  onAddActivity?: (dayIndex: number) => void;
  onDeleteBlock?: (dayIndex: number, blockId: string) => void;
  onSwapBlock?: (original: TimeBlock, replacement: BlockAlternative) => void;
  tripContext?: string;
  hideActionsSidebar?: boolean;
  hideFloatingChat?: boolean;
}

export default function Dashboard({
  plan,
  conversationHistory,
  onBack,
  collaborative,
  onAddActivity,
  onDeleteBlock,
  onSwapBlock,
  tripContext,
  hideActionsSidebar,
  hideFloatingChat,
}: DashboardProps) {
  const [actionItems, setActionItems] = useState<ActionItem[]>(plan.actionItems);
  const [packingList, setPackingList] = useState<PackingItem[]>(plan.packingList || []);
  const [selectedBlock, setSelectedBlock] = useState<TimeBlock | null>(null);
  const [remixBlock, setRemixBlock] = useState<TimeBlock | null>(null);

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
    window.print();
  };

  return (
    <div className="relative min-h-screen">
      {/* Luxury background */}
      <div className="fixed inset-0 z-0">
        <img src={luxuryResort} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/90 to-background/95 backdrop-blur-sm" />
      </div>

      <div className="relative z-10">
        {/* Top bar — glass */}
        <header className="border-b border-white/15 px-6 py-3 flex items-center justify-between sticky top-0 glass-card z-40">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 hover:bg-white/20">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-lg text-foreground">{plan.destination}</h1>
              <p className="text-xs text-muted-foreground font-body tracking-wide">
                {plan.startDate} → {plan.endDate} · {plan.travelers} traveler{plan.travelers > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 rounded-xl border-white/20 glass hover:bg-white/30" onClick={handlePrint}>
              <Download className="w-4 h-4" /> PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl border-white/20 glass hover:bg-white/30"
              onClick={() => downloadICS(plan)}
            >
              <CalendarDays className="w-4 h-4" /> Sync
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex flex-col lg:flex-row">
          {/* Left: Itinerary */}
          <div className={`flex-1 p-6 ${!hideActionsSidebar ? "lg:border-r border-white/10" : ""}`}>
            <h2 className="font-display font-bold text-xl text-foreground mb-4 italic">Your Itinerary</h2>
            <Accordion type="multiple" defaultValue={plan.itinerary.map((_, i) => `day-${i}`)}>
              {plan.itinerary.map((day, idx) => {
                const dedupedBlocks = deduplicateBlocks(day.blocks);
                const regularBlocks = dedupedBlocks
                  .filter(b => b.category !== "accommodation")
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                const accommodationBlocks = dedupedBlocks.filter(b => b.category === "accommodation");

                return (
                  <AccordionItem key={idx} value={`day-${idx}`} className="border-white/10">
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
                            // Map duration to min-height: 30min → 60px, 60min → 80px, 120min+ → 100px+
                            const minHeight = Math.min(Math.max(Math.round(duration * 0.6 + 40), 56), 140);
                            
                            return (
                              <motion.div
                                key={block.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`glass rounded-2xl ${style.colorClass} group relative cursor-pointer hover:shadow-lg transition-all mb-2 flex flex-col justify-center`}
                                style={{ minHeight: `${minHeight}px` }}
                                onClick={() => setSelectedBlock(block)}
                              >
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
                                      {block.cost != null && block.cost > 0 && (
                                        <span className="text-xs font-medium whitespace-nowrap flex items-center gap-0.5">
                                          <DollarSign className="w-3 h-3" />
                                          {block.cost}
                                        </span>
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
                        {accommodationBlocks.map((block) => (
                          <motion.div
                            key={block.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-3 pt-3 border-t border-white/10 cursor-pointer group"
                            onClick={() => setSelectedBlock(block)}
                          >
                            <div className="glass-dark rounded-2xl p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                  <Bed className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-body font-medium text-sm text-foreground">{block.title}</p>
                                  {block.location && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <MapPin className="w-3 h-3" /> {block.location}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {block.cost != null && block.cost > 0 && (
                                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-0.5">
                                    <DollarSign className="w-3 h-3" />{block.cost}/night
                                  </span>
                                )}
                                {onDeleteBlock && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteBlock(idx, block.id); }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          {/* Right: Actions & Budget — glass cards */}
          {!hideActionsSidebar && (
            <div className="lg:w-[380px] p-6 space-y-5">
              <Card className="rounded-2xl border-white/15 glass-card shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    Budget
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm font-body">
                    <span className="text-muted-foreground">Estimated total</span>
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

              <Card className="rounded-2xl border-white/15 glass-card shadow-lg">
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
                                  <span className="text-xs text-muted-foreground ml-1">(~${item.cost})</span>
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
                <Card className="rounded-2xl border-white/15 glass-card shadow-lg">
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
                <Card className="rounded-2xl border-white/15 glass-card shadow-lg">
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
            </div>
          )}
        </div>

        {!hideFloatingChat && <FloatingChat conversationHistory={conversationHistory} currentPlan={plan} onPlanUpdate={() => {}} />}

        <BlockDetailModal
          block={selectedBlock}
          tripContext={tripContext || `${plan.destination}, ${plan.startDate} to ${plan.endDate}, ${plan.travelers} travelers`}
          onClose={() => setSelectedBlock(null)}
          onSwap={(original, replacement) => {
            onSwapBlock?.(original, replacement);
            setSelectedBlock(null);
          }}
        />
      </div>
    </div>
  );
}
