import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TripIntake } from "@/types/intake";
import { TripPlan, TimeBlock, ActionItem } from "@/types/itinerary";
import { BlockAlternative } from "@/lib/chat";
import { generateFromIntake } from "@/lib/chat";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Dashboard from "@/components/Dashboard";
import ActionItemsModal from "./ActionItemsModal";
import FloatingChat from "@/components/FloatingChat";
import AuthPromptDialog from "@/components/AuthPromptDialog";
import TravelerManager from "@/components/TravelerManager";
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
  const [isGenerating, setIsGenerating] = useState(!loadedPlan);
  const [actionItems, setActionItems] = useState<ActionItem[]>(loadedPlan?.actionItems || []);
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();
  const { isOptedIn, toggleOptIn, budgetCap, setBudgetCap } = useMemberOptIns(tripId);
  const { travelers, expenses, addExpense, deleteExpense, addTraveler, removeTraveler } = useExpenses(tripId);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showTravelers, setShowTravelers] = useState(false);
  const pendingSaveRef = useRef(false);

  const intakeContext = intakeToContext(intake);
  const conversationHistory = [{ role: "system", content: intakeContext }];

  useEffect(() => {
    if (loadedPlan) return;
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
    const planWithActions = { ...plan, actionItems };

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
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50" />
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
          setTimeout(() => performSave(), 500);
        }}
      />
    </div>
  );
}
