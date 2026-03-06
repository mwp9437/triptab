import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { TripIntake, ActivityOption } from "@/types/intake";
import { TripPlan, TimeBlock, ActionItem } from "@/types/itinerary";
import { BlockAlternative } from "@/lib/chat";
import { generateFromIntake } from "@/lib/chat";
import { toast } from "@/hooks/use-toast";
import Dashboard from "@/components/Dashboard";
import ChatPanel from "./ChatPanel";
import OptionsPanel from "./OptionsPanel";
import ActionItemsModal from "./ActionItemsModal";
import FloatingChat from "@/components/FloatingChat";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PlanningWorkspaceProps {
  intake: TripIntake;
  onBack: () => void;
}

function createEmptyPlan(intake: TripIntake): TripPlan {
  const start = new Date(intake.startDate + "T00:00:00");
  const end = new Date(intake.endDate + "T00:00:00");
  const days = [];
  const d = new Date(start);
  let dayNum = 1;
  while (d <= end) {
    days.push({
      date: d.toISOString().split("T")[0],
      dayNumber: dayNum,
      title: `Day ${dayNum}`,
      blocks: [],
    });
    d.setDate(d.getDate() + 1);
    dayNum++;
  }
  if (days.length === 0) {
    days.push({ date: intake.startDate || new Date().toISOString().split("T")[0], dayNumber: 1, title: "Day 1", blocks: [] });
  }
  return {
    destination: intake.destination,
    startDate: intake.startDate,
    endDate: intake.endDate,
    travelers: intake.travelerCount,
    itinerary: days,
    actionItems: [],
    budget: { total: 0, spent: 0, categories: {} },
  };
}

function intakeToContext(intake: TripIntake): string {
  const budgetLabels = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };
  return `Trip context: ${intake.destination}, ${intake.startDate} to ${intake.endDate}, ${intake.travelerCount} travelers (${intake.travelerType}). Budget: accommodation ${budgetLabels[intake.budget.accommodation]}, meals ${budgetLabels[intake.budget.meals]}, activities ${budgetLabels[intake.budget.activities]}, transport ${budgetLabels[intake.budget.transportation]}. Vibes: ${intake.vibes.join(", ") || "none specified"}. Dietary: ${intake.dietary.join(", ") || "none"}. Mobility: ${intake.mobility}. Must-dos: ${intake.mustDos || "none"}. Avoid: ${intake.avoids || "none"}.`;
}

export default function PlanningWorkspace({ intake, onBack }: PlanningWorkspaceProps) {
  const [plan, setPlan] = useState<TripPlan | null>(
    intake.planningMode === "collaborative" ? createEmptyPlan(intake) : null
  );
  const [isGenerating, setIsGenerating] = useState(intake.planningMode === "auto");
  const [chatCollapsed, setChatCollapsed] = useState(false); // Always show chat in both modes
  const [options, setOptions] = useState<ActivityOption[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [mobileTab, setMobileTab] = useState("itinerary");
  const isMobile = useIsMobile();

  const intakeContext = intakeToContext(intake);
  const conversationHistory = [{ role: "system", content: intakeContext }];

  useEffect(() => {
    if (intake.planningMode !== "auto") return;
    let cancelled = false;

    (async () => {
      try {
        const generated = await generateFromIntake(intake);
        if (!cancelled) {
          setPlan(generated);
          setActionItems(generated.actionItems || []);
          setIsGenerating(false);
          setIsGenerating(false);
        }
      } catch {
        if (!cancelled) {
          toast({
            title: "Generation failed",
            description: "Couldn't create your itinerary. Please try again.",
            variant: "destructive",
          });
          setIsGenerating(false);
          setPlan(createEmptyPlan(intake));
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const toggleActionItem = (id: string) => {
    setActionItems((items) =>
      items.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const handlePlanUpdate = (updatedPlan: TripPlan) => {
    setPlan(updatedPlan);
    if (updatedPlan.actionItems) {
      setActionItems(updatedPlan.actionItems);
    }
    toast({ title: "Itinerary updated", description: "Your changes have been applied." });
  };

  const handleDeleteBlock = (dayIndex: number, blockId: string) => {
    if (!plan) return;
    const updatedDays = [...plan.itinerary];
    updatedDays[dayIndex] = {
      ...updatedDays[dayIndex],
      blocks: updatedDays[dayIndex].blocks.filter((b) => b.id !== blockId),
    };
    setPlan({ ...plan, itinerary: updatedDays });
  };

  const handleSwapBlock = (original: TimeBlock, replacement: BlockAlternative) => {
    if (!plan) return;
    const updatedDays = plan.itinerary.map((day) => ({
      ...day,
      blocks: day.blocks.map((b) =>
        b.id === original.id
          ? {
              ...b,
              title: replacement.title,
              location: replacement.location,
              cost: replacement.cost,
              notes: replacement.description,
            }
          : b
      ),
    }));
    setPlan({ ...plan, itinerary: updatedDays });
    toast({ title: "Swapped", description: `Replaced "${original.title}" with "${replacement.title}".` });
  };

  const handleSelectOption = (opt: ActivityOption) => {
    if (!plan) return;
    const block: TimeBlock = {
      id: `block-${Date.now()}`,
      startTime: opt.startTime,
      endTime: opt.endTime,
      title: opt.title,
      location: opt.location,
      cost: opt.estimatedCost,
      category: opt.category,
      notes: opt.description,
    };

    const updatedDays = [...plan.itinerary];
    const targetDay = updatedDays.reduce((a, b) => a.blocks.length <= b.blocks.length ? a : b);
    targetDay.blocks = [...targetDay.blocks, block].sort((a, b) => a.startTime.localeCompare(b.startTime));

    setPlan({ ...plan, itinerary: updatedDays });
    setOptions([]);
  };

  const handleSuggestionsReady = (opts: ActivityOption[], followUp: string) => {
    setOptions(opts);
    if (isMobile) setMobileTab("options");
  };

  const handleAddActivity = (dayIndex: number) => {
    if (isMobile) setMobileTab("chat");
    setChatCollapsed(false);
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="font-display font-bold text-xl text-foreground mb-2">Crafting your itinerary</h2>
          <p className="text-sm text-muted-foreground font-body">This usually takes 10–20 seconds...</p>
        </motion.div>
      </div>
    );
  }

  if (!plan) return null;

  const planWithActions = { ...plan, actionItems };

  // Mobile layout
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex-1 overflow-hidden">
          <Tabs value={mobileTab} onValueChange={setMobileTab} className="h-full flex flex-col">
            <div className="flex-1 overflow-hidden">
              <TabsContent value="chat" className="h-full m-0">
                <ChatPanel
                  conversationHistory={conversationHistory}
                  collaborative={intake.planningMode === "collaborative"}
                  onSuggestionsReady={handleSuggestionsReady}
                  onPlanUpdate={handlePlanUpdate}
                  currentPlan={plan}
                  intakeContext={intakeContext}
                />
              </TabsContent>
              <TabsContent value="options" className="h-full m-0">
                {options.length > 0 ? (
                  <OptionsPanel options={options} onSelect={handleSelectOption} onClose={() => { setOptions([]); setMobileTab("itinerary"); }} />
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground font-body">
                    No options yet. Ask for suggestions in chat.
                  </div>
                )}
              </TabsContent>
              <TabsContent value="itinerary" className="h-full m-0 overflow-y-auto">
                <Dashboard
                  plan={planWithActions}
                  conversationHistory={[]}
                  onBack={onBack}
                  collaborative={intake.planningMode === "collaborative"}
                  onAddActivity={handleAddActivity}
                  onDeleteBlock={handleDeleteBlock}
                  onSwapBlock={handleSwapBlock}
                  tripContext={intakeContext}
                  hideActionsSidebar
                  hideFloatingChat
                />
              </TabsContent>
            </div>
            <TabsList className="w-full rounded-none border-t border-border h-12 bg-card">
              <TabsTrigger value="chat" className="flex-1 font-body text-xs">Chat</TabsTrigger>
              <TabsTrigger value="options" className="flex-1 font-body text-xs relative">
                Options
                {options.length > 0 && (
                  <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-accent" />
                )}
              </TabsTrigger>
              <TabsTrigger value="itinerary" className="flex-1 font-body text-xs">Itinerary</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <ActionItemsModal items={actionItems} onToggle={toggleActionItem} />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="h-screen flex bg-background">
      {/* Chat Panel — always visible, collapsible */}
      <div className={chatCollapsed ? "w-10" : "w-[320px]"} style={{ transition: "width 0.2s" }}>
        <ChatPanel
          conversationHistory={conversationHistory}
          collapsed={chatCollapsed}
          onToggle={() => setChatCollapsed(!chatCollapsed)}
          collaborative={intake.planningMode === "collaborative"}
          onSuggestionsReady={handleSuggestionsReady}
          onPlanUpdate={handlePlanUpdate}
          currentPlan={plan}
          intakeContext={intakeContext}
        />
      </div>

      {/* Itinerary */}
      <div className="flex-1 overflow-y-auto">
        <Dashboard
          plan={planWithActions}
          conversationHistory={[]}
          onBack={onBack}
          collaborative={intake.planningMode === "collaborative"}
          onAddActivity={handleAddActivity}
          onDeleteBlock={handleDeleteBlock}
          onSwapBlock={handleSwapBlock}
          tripContext={intakeContext}
          hideFloatingChat
        />
      </div>

      {/* Options Panel */}
      <AnimatePresence>
        {options.length > 0 && (
          <div className="w-[350px]">
            <OptionsPanel
              options={options}
              onSelect={handleSelectOption}
              onClose={() => setOptions([])}
            />
          </div>
        )}
      </AnimatePresence>

      <ActionItemsModal items={actionItems} onToggle={toggleActionItem} />

      {/* Floating chat when panel is collapsed */}
      {chatCollapsed && (
        <FloatingChat
          conversationHistory={conversationHistory}
          currentPlan={plan}
          onPlanUpdate={handlePlanUpdate}
        />
      )}
    </div>
  );
}
