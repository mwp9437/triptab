import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TripIntake } from "@/types/intake";
import { TripPlan, TimeBlock, ActionItem } from "@/types/itinerary";
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
  return { destination: intake.destination, startDate: intake.startDate, endDate: intake.endDate, travelers: intake.travelerCount, itinerary: days, actionItems: [], budget: { total: 0, spent: 0, categories: {} } };
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
  const { travelers, expenses, addExpense, deleteExpense, addTraveler, removeTraveler } = useExpenses(tripId);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showTravelers, setShowTravelers] = useState(false);
  const [accommodationDetails, setAccommodationDetails] = useState<AccommodationDetails>((loadedPlan as any)?.accommodationDetails || {});
  const [bedroomAssignments, setBedroomAssignments] = useState<BedroomAssignment[]>((loadedPlan as any)?.bedroomAssignments || []);
  const [datePoll, setDatePoll] = useState<DatePollData>((loadedPlan as any)?.datePoll || { options: [], votes: {} });
  const [slotSuggestions, setSlotSuggestions] = useState<Record<string, any[]>>({});
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsRequestedRef = useRef(false);
  const pendingSaveRef = useRef(false);

  const intakeContext = intakeToContext(intake);
  const conversationHistory = [{ role: "system", content: intakeContext }];

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
        if (!cancelled) { setPlan(generated); setActionItems(generated.actionItems || []); setIsGenerating(false); }
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

  // Pre-fetch AI suggestions for days with empty slots (only for skipAiGeneration trips)
  useEffect(() => {
    if (!plan || !intake.skipAiGeneration || suggestionsRequestedRef.current) return;
    const SLOTS = [
      { label: "Morning Activity", startTime: "09:00", endTime: "12:00", category: "activity" },
      { label: "Lunch", startTime: "12:00", endTime: "13:30", category: "meal" },
      { label: "Afternoon Activity", startTime: "14:00", endTime: "17:00", category: "activity" },
      { label: "Dinner", startTime: "19:00", endTime: "21:00", category: "meal" },
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
          ? { ...b, title: replacement.title, location: replacement.location, cost: replacement.cost, notes: replacement.description }
          : b
      ),
    }));
    setPlan({ ...plan, itinerary: updatedDays });
    toast({ title: "Swapped", description: `Replaced "${original.title}" with "${replacement.title}".` });
  };

  const handleAddActivity = (dayIndex: number, block?: any) => {
    if (!plan || !block) return;
    const updatedDays = [...plan.itinerary];
    updatedDays[dayIndex] = {
      ...updatedDays[dayIndex],
      blocks: [...updatedDays[dayIndex].blocks, block].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    };
    setPlan({ ...plan, itinerary: updatedDays });
    toast({ title: "Activity added", description: `"${block.title}" added to Day ${dayIndex + 1}.` });
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
    const planWithActions = { ...plan, actionItems, accommodationDetails, bedroomAssignments, datePoll };

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
        <Dashboard
          plan={planWithActions}
          conversationHistory={[]}
          onBack={onBack}
          onDeleteBlock={handleDeleteBlock}
          onSwapBlock={handleSwapBlock}
          onUpdateBlockCost={handleUpdateBlockCost}
          onAddActivity={handleAddActivity}
          tripContext={intakeContext}
          hideFloatingChat
          onSave={handleSave}
          saving={saving}
          tripId={tripId}
          isOptedIn={isOptedIn}
          onToggleOptIn={toggleOptIn}
          budgetCap={budgetCap}
          onSetBudgetCap={setBudgetCap}
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
