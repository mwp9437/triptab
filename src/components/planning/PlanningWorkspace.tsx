import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TripIntake } from "@/types/intake";
import { TripPlan, TimeBlock, ActionItem, ChatMessage } from "@/types/itinerary";
import { BlockAlternative, suggestActivities } from "@/lib/chat";
import { generateFromIntake } from "@/lib/chat";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Dashboard from "@/components/Dashboard";
import ActionItemsModal from "./ActionItemsModal";
import FloatingChat from "@/components/FloatingChat";
import AuthPromptDialog from "@/components/AuthPromptDialog";
import TravelerManager from "@/components/TravelerManager";
import { AccommodationDetails, BedroomAssignment } from "@/components/AccommodationHub";
import { DatePollData } from "@/components/DatePoll";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMemberOptIns } from "@/hooks/use-member-optins";
import { useExpenses } from "@/hooks/use-expenses";
import luxuryBedroom from "@/assets/luxury-bedroom.png";

function createEmptyPlan(intake: TripIntake): TripPlan {
  const start = new Date(intake.startDate + "T00:00:00");
  const end = new Date(intake.endDate + "T00:00:00");
  const days = [];
  const d = new Date(start);
  let dayNum = 1;
  while (d <= end) {
    days.push({ date: d.toISOString().split("T")[0], dayNumber: dayNum, title: `Day ${dayNum}`, blocks: [] });
    d.setDate(d.getDate() + 1);
    dayNum++;
  }
  if (days.length === 0) {
    days.push({ date: intake.startDate || new Date().toISOString().split("T")[0], dayNumber: 1, title: "Day 1", blocks: [] });
  }
  return { destination: intake.destination, startDate: intake.startDate, endDate: intake.endDate, travelers: intake.travelerCount, itinerary: days, actionItems: [], budget: { total: 0, spent: 0, categories: {} }, packingList: [], localTips: [] };
}

function intakeToContext(intake: TripIntake): string {
  const budgetLabels = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };
  return `Trip context: Departing from: ${intake.homeCity || "not specified"}. ${intake.destination}, ${intake.startDate} to ${intake.endDate}, ${intake.travelerCount} travelers (${intake.travelerType}). Budget: accommodation ${budgetLabels[intake.budget.accommodation]}, meals ${budgetLabels[intake.budget.meals]}, activities ${budgetLabels[intake.budget.activities]}, transport ${budgetLabels[intake.budget.transportation]}. Vibes: ${intake.vibes.join(", ") || "none specified"}. Dietary: ${intake.dietary.join(", ") || "none"}. Mobility: ${intake.mobility}. Must-dos: ${intake.mustDos || "none"}. Avoid: ${intake.avoids || "none"}.`;
}

interface PlanningWorkspaceProps {
  intake: TripIntake;
  onBack: () => void;
  loadedTripId?: string | null;
  loadedPlan?: any;
}

export default function PlanningWorkspace({ intake, onBack, loadedTripId, loadedPlan }: PlanningWorkspaceProps) {
  const { user } = useAuth();
  const [tripId, setTripId] = useState<string | null>(loadedTripId || null);
  const [plan, setPlan] = useState<TripPlan | null>(loadedPlan || null);
  const [isGenerating, setIsGenerating] = useState(!loadedPlan && !intake.skipAiGeneration);
  const [actionItems, setActionItems] = useState<ActionItem[]>(loadedPlan?.actionItems || []);
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();
  const { isOptedIn, toggleOptIn, budgetCap, setBudgetCap } = useMemberOptIns(tripId);
  const { travelers, expenses, addExpense, deleteExpense, updateExpense, addTraveler, removeTraveler } = useExpenses(tripId);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showTravelers, setShowTravelers] = useState(false);
  const [accommodationDetails, setAccommodationDetails] = useState<AccommodationDetails>((loadedPlan as any)?.accommodationDetails || {});
  const [bedroomAssignments, setBedroomAssignments] = useState<BedroomAssignment[]>((loadedPlan as any)?.bedroomAssignments || []);
  const [datePoll, setDatePoll] = useState<DatePollData>((loadedPlan as any)?.datePoll || { options: [], votes: {} });
  const [personalBudget, setPersonalBudget] = useState<number | null>((loadedPlan as any)?.personalBudget ?? null);
  const [slotSuggestions, setSlotSuggestions] = useState<Record<string, any[]>>({});
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsRequestedRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const [chatInitialMessages, setChatInitialMessages] = useState<ChatMessage[]>([]);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);
  const gapCheckDoneRef = useRef(false);

  const intakeContext = intakeToContext(intake);
  const conversationHistory = [{ role: "system", content: intakeContext }];
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (loadedPlan) return;
    if (intake.skipAiGeneration) {
      setPlan(createEmptyPlan(intake));
      setIsGenerating(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const generated = await generateFromIntake(intake);
        if (cancelled) return;
        if ((generated as any).needsMoreInfo) {
          const questions = (generated as any).questions?.join("\n") || "I need a few more details to plan your trip.";
          const emptyPlan = createEmptyPlan(intake);
          setPlan(emptyPlan);
          setIsGenerating(false);
          setInfoBanner("I have a few questions to make your itinerary better — check the chat!");
          setChatInitialMessages([{
            id: `gap-${Date.now()}`,
            role: "assistant",
            content: questions,
            timestamp: new Date(),
          }]);
        } else {
          // Mark all AI-generated blocks as "suggested"
          const planWithStatus = {
            ...generated,
            itinerary: generated.itinerary.map(day => ({
              ...day,
              blocks: day.blocks.map(block => ({
                ...block,
                status: "suggested" as const,
              })),
            })),
          };
          setPlan(planWithStatus); setActionItems(generated.actionItems || []); setIsGenerating(false);
        }
      } catch {
        if (!cancelled) {
          toast({ title: "Generation failed", description: "Couldn't create your itinerary. Please try again.", variant: "destructive" });
          setIsGenerating(false);
          setPlan(createEmptyPlan(intake));
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reconcile block statuses with existing expenses on load
  // If a block has a linked expense but status is "suggested", fix it to "confirmed"
  useEffect(() => {
    if (!plan || expenses.length === 0) return;
    const expenseBlockIds = new Set(expenses.map((e) => e.blockId).filter(Boolean));
    if (expenseBlockIds.size === 0) return;
    let changed = false;
    const reconciled = {
      ...plan,
      itinerary: plan.itinerary.map((day) => ({
        ...day,
        blocks: day.blocks.map((block) => {
          if (expenseBlockIds.has(block.id) && block.status !== "confirmed") {
            changed = true;
            return {
              ...block,
              status: "confirmed" as const,
              confirmedDetails: {
                ...block.confirmedDetails,
                expenseCreated: true,
                confirmedAt: block.confirmedDetails?.confirmedAt || new Date().toISOString(),
              },
            };
          }
          return block;
        }),
      })),
    };
    if (changed) setPlan(reconciled);
  }, [expenses]);

  // Detect gaps in the plan and queue chat questions
  useEffect(() => {
    if (!plan || gapCheckDoneRef.current || loadedPlan || chatInitialMessages.length > 0) return;
    gapCheckDoneRef.current = true;
    const gaps: string[] = [];

    const hasAccommodation = plan.itinerary.some(d => d.blocks.some(b => b.category === "accommodation"));
    if (!hasAccommodation && !intake.preExistingDetails?.match(/stay|hotel|airbnb|hostel|friend|camp|lodge|cabin|resort|vrbo/i)) {
      gaps.push("I notice we don't have lodging set up yet. Where are you staying? I can suggest hotels or just add your booking.");
    }

    const hasTransport = plan.itinerary.some(d => d.blocks.some(b => b.category === "transport"));
    if (!hasTransport && !intake.needsFlights) {
      gaps.push(`How are you getting to ${intake.destination}? I can help plan flights or skip transport if you've got it covered.`);
    }

    if (gaps.length > 0) {
      setChatInitialMessages([{
        id: `gap-${Date.now()}`,
        role: "assistant",
        content: gaps.join("\n\n"),
        timestamp: new Date(),
      }]);
    }
  }, [plan]);

  // Pre-fetch AI suggestions for days with empty slots (only for skipAiGeneration trips)
  useEffect(() => {
    if (!plan || !intake.skipAiGeneration || suggestionsRequestedRef.current) return;
    const SLOTS = [
      { label: "Morning Activity", startTime: "09:00", endTime: "12:00", category: "activity" },
      { label: "Lunch", startTime: "12:00", endTime: "13:30", category: "meal" },
      { label: "Afternoon Activity", startTime: "14:00", endTime: "17:00", category: "activity" },
    ];
    // Check if any day has empty slots
    const hasSparse = plan.itinerary.some(day => {
      const blocks = day.blocks.filter(b => b.category !== "accommodation");
      return SLOTS.some(slot => !blocks.some(b => b.startTime < slot.endTime && b.endTime > slot.startTime));
    });
    if (!hasSparse) return;
    suggestionsRequestedRef.current = true;
    setSuggestionsLoading(true);

    (async () => {
      const results: Record<string, any[]> = {};
      // Fetch for each day (batch all days in parallel)
      await Promise.all(plan.itinerary.map(async (day, dayIdx) => {
        const blocks = day.blocks.filter(b => b.category !== "accommodation");
        const missing = SLOTS.filter(slot => !blocks.some(b => b.startTime < slot.endTime && b.endTime > slot.startTime));
        if (missing.length === 0) return;

        try {
          const slotDescriptions = missing.map(s => s.label).join(", ");
          const request = `Suggest activities for Day ${day.dayNumber} (${day.date}). Need: ${slotDescriptions}. For each slot, suggest 1 specific activity with title, description, estimated cost, and category. Keep it concise.`;
          const result = await suggestActivities(
            [{ role: "system", content: intakeContext }],
            request
          );
          const suggestions = result.suggestions || [];
          // Distribute suggestions across slots
          missing.forEach((slot, i) => {
            const key = `${dayIdx}-${slot.label}`;
            // Try to match by category or just assign by index
            const matched = suggestions.filter((s: any) => {
              if (slot.category === "meal") return /meal|lunch|dinner|food|eat|restaurant/i.test(s.category || s.title || "");
              return !/meal|lunch|dinner|food/i.test(s.category || "");
            });
            results[key] = matched.length > 0 ? matched.slice(0, 4) : suggestions.slice(i, i + 1);
          });
        } catch {
          // Silently fail — placeholders will show generic text
        }
      }));
      // Deduplicate: remove suggestions with duplicate titles across all slots
      const seenTitles = new Set<string>();
      for (const key of Object.keys(results)) {
        results[key] = results[key].filter((s: any) => {
          const norm = (s.title || "").toLowerCase().trim();
          if (seenTitles.has(norm)) return false;
          seenTitles.add(norm);
          return true;
        });
      }
      setSlotSuggestions(results);
      setSuggestionsLoading(false);
    })();
  }, [plan, intake.skipAiGeneration, intakeContext]);

  const toggleActionItem = (id: string) => {
    setActionItems((items) => items.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)));
  };

  const handlePlanUpdate = (updatedPlan: TripPlan) => {
    setPlan(updatedPlan);
    if (updatedPlan.actionItems) setActionItems(updatedPlan.actionItems);
    toast({ title: "Itinerary updated", description: "Your changes have been applied." });
  };

  const handleDeleteBlock = (dayIndex: number, blockId: string) => {
    if (!plan) return;
    const updatedDays = [...plan.itinerary];
    updatedDays[dayIndex] = { ...updatedDays[dayIndex], blocks: updatedDays[dayIndex].blocks.filter((b) => b.id !== blockId) };
    setPlan({ ...plan, itinerary: updatedDays });
  };

  const handleUpdateBlockCost = (dayIndex: number, blockId: string, cost: number) => {
    if (!plan) return;
    const updatedDays = [...plan.itinerary];
    updatedDays[dayIndex] = {
      ...updatedDays[dayIndex],
      blocks: updatedDays[dayIndex].blocks.map((b) => b.id === blockId ? { ...b, cost, isUserPrice: true } : b),
    };
    setPlan({ ...plan, itinerary: updatedDays });
  };

  const handleSwapBlock = (original: TimeBlock, replacement: BlockAlternative) => {
    if (!plan) return;
    const updatedDays = plan.itinerary.map((day) => ({
      ...day,
      blocks: day.blocks.map((b) =>
        b.id === original.id
          ? { ...b, title: replacement.title, location: replacement.location, cost: replacement.cost, notes: replacement.description, status: "suggested" as const }
          : b
      ),
    }));
    setPlan({ ...plan, itinerary: updatedDays });
    toast({ title: "Swapped", description: `Replaced "${original.title}" with "${replacement.title}".` });
  };

  const handleAddActivity = (dayIndex: number, block?: any) => {
    if (!plan || !block) return;
    const updatedDays = [...plan.itinerary];
    // User-added blocks are "confirmed" by default
    const blockWithStatus = { ...block, status: block.status || "confirmed" };
    updatedDays[dayIndex] = {
      ...updatedDays[dayIndex],
      blocks: [...updatedDays[dayIndex].blocks, blockWithStatus].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    };
    setPlan({ ...plan, itinerary: updatedDays });
    toast({ title: "Activity added", description: `"${block.title}" added to Day ${dayIndex + 1}.` });
  };

  const handleUpdateBlock = (dayIndex: number, blockId: string, updates: Partial<TimeBlock>) => {
    if (!plan) return;
    const updatedDays = [...plan.itinerary];
    updatedDays[dayIndex] = {
      ...updatedDays[dayIndex],
      blocks: updatedDays[dayIndex].blocks.map((b) => b.id === blockId ? { ...b, ...updates } : b),
    };
    setPlan({ ...plan, itinerary: updatedDays });
  };

  const handleUpdateAccommodation = (details: AccommodationDetails, bedrooms: BedroomAssignment[]) => {
    setAccommodationDetails(details);
    setBedroomAssignments(bedrooms);
  };

  const handleUpdateDatePoll = (poll: DatePollData) => {
    setDatePoll(poll);
  };

  const handleLockDates = (startDate: string, endDate: string) => {
    if (!plan) return;
    setPlan({ ...plan, startDate, endDate });
  };

  const handleSave = async () => {
    if (!plan) return;
    if (!user) {
      pendingSaveRef.current = true;
      setShowAuthPrompt(true);
      return;
    }
    await performSave();
  };

  useEffect(() => {
    if (user && pendingSaveRef.current) {
      pendingSaveRef.current = false;
      performSave();
    }
  }, [user]);

  const performSave = async () => {
    console.log("performSave called", { hasPlan: !!plan, hasUser: !!user, tripId });
    if (!plan || !user) return;
    setSaving(true);
    const planWithActions = { ...plan, actionItems, accommodationDetails, bedroomAssignments, datePoll, personalBudget };

    try {
      if (tripId) {
        const { error } = await supabase.from("trips").update({
          plan_data: planWithActions as any,
          intake_data: intake as any,
          title: plan.destination,
          updated_at: new Date().toISOString(),
        } as any).eq("id", tripId);
        if (error) throw error;
        toast({ title: "Saved!", description: "Your trip has been updated." });
      } else {
        const { data, error } = await supabase.from("trips").insert({
          user_id: user.id,
          title: plan.destination,
          intake_data: intake as any,
          plan_data: planWithActions as any,
        } as any).select().single();
        if (error) throw error;
        setTripId((data as any).id);
        toast({ title: "Saved!", description: "Your trip has been saved." });
      }
    } catch (err: any) {
      console.error("Save error:", err);
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  // Debounced auto-save: persist plan to Supabase 2s after any change
  useEffect(() => {
    if (!plan || !tripId || !user) return;
    // Skip the initial load to avoid a spurious save
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      const planToSave = { ...plan, actionItems, accommodationDetails, bedroomAssignments, datePoll, personalBudget };
      await supabase.from("trips").update({
        plan_data: planToSave as any,
        updated_at: new Date().toISOString(),
      } as any).eq("id", tripId);
    }, 2000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [plan, actionItems, accommodationDetails, bedroomAssignments, datePoll, personalBudget, tripId, user]);

  if (isGenerating) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={luxuryBedroom} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/30" />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 text-center glass-card rounded-3xl p-12 max-w-md mx-4">
          <div className="w-16 h-16 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-6" />
          <h2 className="font-display font-bold text-2xl text-foreground mb-2 italic">Curating your experience</h2>
          <p className="text-sm text-muted-foreground font-body">This usually takes 10–20 seconds...</p>
        </motion.div>
      </div>
    );
  }

  if (!plan) return null;

  const planWithActions = { ...plan, actionItems };

  return (
    <div className="h-screen flex bg-background">
      <div className="flex-1 overflow-y-auto">
        {infoBanner && (
          <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center justify-between">
            <p className="text-sm font-body text-primary">{infoBanner}</p>
            <button onClick={() => setInfoBanner(null)} className="text-primary/60 hover:text-primary text-xs font-body">Dismiss</button>
          </div>
        )}
        <Dashboard
          plan={planWithActions}
          conversationHistory={[]}
          onBack={onBack}
          onDeleteBlock={handleDeleteBlock}
          onSwapBlock={handleSwapBlock}
          onUpdateBlockCost={handleUpdateBlockCost}
          onAddActivity={handleAddActivity}
          onUpdateBlock={handleUpdateBlock}
          tripContext={intakeContext}
          hideFloatingChat
          onSave={handleSave}
          saving={saving}
          tripId={tripId}
          isOptedIn={isOptedIn}
          onToggleOptIn={toggleOptIn}
          budgetCap={budgetCap}
          onSetBudgetCap={setBudgetCap}
          personalBudget={personalBudget}
          onSetPersonalBudget={setPersonalBudget}
          travelerSlot={tripId ? (
            <TravelerManager
              travelers={travelers}
              expenses={expenses}
              travelerCount={intake.travelerCount}
              tripId={tripId}
              onAddTraveler={addTraveler}
              onRemoveTraveler={removeTraveler}
              externalOpen={showTravelers}
              onExternalOpenChange={setShowTravelers}
            />
          ) : undefined}
          expenses={expenses}
          travelers={travelers}
          onAddExpense={addExpense}
          onDeleteExpense={deleteExpense}
          onUpdateExpense={updateExpense}
          onOpenTravelers={() => setShowTravelers(true)}
          defaultTab={intake.expensesOnly ? "expenses" : undefined}
          accommodationDetails={accommodationDetails}
          bedroomAssignments={bedroomAssignments}
          onUpdateAccommodation={handleUpdateAccommodation}
          isOwner={true}
          datePoll={datePoll}
          onUpdateDatePoll={handleUpdateDatePoll}
          onLockDates={handleLockDates}
          currentTravelerId={travelers.find((t) => t.isCurrentUser)?.id}
          slotSuggestions={slotSuggestions}
          slotSuggestionsLoading={suggestionsLoading}
        />
      </div>

      <ActionItemsModal items={actionItems} onToggle={toggleActionItem} />

      <FloatingChat
        conversationHistory={conversationHistory}
        currentPlan={plan}
        onPlanUpdate={handlePlanUpdate}
        intakeContext={intakeContext}
        initialMessages={chatInitialMessages}
      />

      <AuthPromptDialog
        open={showAuthPrompt}
        onOpenChange={setShowAuthPrompt}
        onAuthenticated={() => {
          // Save will be triggered by the useEffect watching for user
        }}
      />
    </div>
  );
}
