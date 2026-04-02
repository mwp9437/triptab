import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TripPlan, TimeBlock } from "@/types/itinerary";
import { BlockAlternative } from "@/lib/chat";
import Dashboard from "@/components/Dashboard";
import { AccommodationDetails, BedroomAssignment } from "@/components/AccommodationHub";
import { DatePollData } from "@/components/DatePoll";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useExpenses } from "@/hooks/use-expenses";
import TravelerManager from "@/components/TravelerManager";

type CollabRole = "owner" | "editor" | "viewer";

export default function SharedTrip() {
  const { tripId } = useParams<{ tripId: string }>();
  const [searchParams] = useSearchParams();
  const urlRole = searchParams.get("role") || "viewer";
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [effectiveRole, setEffectiveRole] = useState<CollabRole>("viewer");
  const [saving, setSaving] = useState(false);
  const [accommodationDetails, setAccommodationDetails] = useState<AccommodationDetails>({});
  const [bedroomAssignments, setBedroomAssignments] = useState<BedroomAssignment[]>([]);
  const [datePoll, setDatePoll] = useState<DatePollData>({ options: [], votes: {} });
  const { travelers, expenses, addExpense, deleteExpense, updateExpense, addTraveler, removeTraveler } = useExpenses(tripId);
  const [showTravelers, setShowTravelers] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate(`/auth?redirect=/trip/${tripId}`);
      return;
    }

    async function fetchTrip() {
      if (!tripId) return;
      setLoading(true);

      const { data: trip, error: fetchError } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();

      if (fetchError || !trip) {
        setError("Trip not found or you don't have access.");
        setLoading(false);
        return;
      }

      // Determine role
      if (trip.user_id === user!.id) {
        setEffectiveRole("owner");
      } else {
        const { data: collab } = await supabase
          .from("trip_collaborators")
          .select("id, role")
          .eq("trip_id", tripId)
          .eq("user_id", user!.id);

        if (collab && collab.length > 0) {
          setEffectiveRole((collab[0] as any).role === "editor" ? "editor" : "viewer");
        } else {
          // Auto-add as collaborator
          await supabase.from("trip_collaborators").insert({
            trip_id: tripId,
            user_id: user!.id,
            invited_email: user!.email || "",
            role: urlRole as any,
            accepted: true,
          } as any);
          setEffectiveRole(urlRole === "editor" ? "editor" : "viewer");
        }
      }

      const planData = trip.plan_data as any;
      setPlan(planData as unknown as TripPlan);
      setAccommodationDetails(planData?.accommodationDetails || {});
      setBedroomAssignments(planData?.bedroomAssignments || []);
      setDatePoll(planData?.datePoll || { options: [], votes: {} });
      setLoading(false);
    }

    fetchTrip();
  }, [tripId, user, authLoading, navigate, urlRole]);

  const canEdit = effectiveRole === "owner" || effectiveRole === "editor";
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);

  // Debounced auto-save for SharedTrip
  useEffect(() => {
    if (!plan || !tripId || !canEdit) return;
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      const planToSave = { ...plan, accommodationDetails, bedroomAssignments, datePoll };
      await supabase.from("trips").update({
        plan_data: planToSave as any,
        updated_at: new Date().toISOString(),
      }).eq("id", tripId);
    }, 2000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [plan, accommodationDetails, bedroomAssignments, datePoll, tripId, canEdit]);

  const handleDeleteBlock = useCallback((dayIndex: number, blockId: string) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const itinerary = [...prev.itinerary];
      const day = { ...itinerary[dayIndex] };
      day.blocks = day.blocks.filter((b) => b.id !== blockId);
      itinerary[dayIndex] = day;
      return { ...prev, itinerary };
    });
  }, []);

  const handleSwapBlock = useCallback((original: TimeBlock, replacement: BlockAlternative) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const itinerary = prev.itinerary.map((day) => ({
        ...day,
        blocks: day.blocks.map((b) =>
          b.id === original.id
            ? { ...b, title: replacement.title, description: replacement.description, cost: replacement.cost }
            : b
        ),
      }));
      return { ...prev, itinerary };
    });
  }, []);

  const handleUpdateBlockCost = useCallback((dayIndex: number, blockId: string, cost: number) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const itinerary = [...prev.itinerary];
      const day = { ...itinerary[dayIndex] };
      day.blocks = day.blocks.map((b) => (b.id === blockId ? { ...b, cost } : b));
      itinerary[dayIndex] = day;
      return { ...prev, itinerary };
    });
  }, []);

  const handleUpdateBlock = useCallback((dayIndex: number, blockId: string, updates: Partial<TimeBlock>) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const itinerary = [...prev.itinerary];
      const day = { ...itinerary[dayIndex] };
      day.blocks = day.blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b));
      itinerary[dayIndex] = day;
      return { ...prev, itinerary };
    });
  }, []);

  const handleAddActivity = useCallback((dayIndex: number, block?: any) => {
    if (!block) return;
    setPlan((prev) => {
      if (!prev) return prev;
      const itinerary = [...prev.itinerary];
      const day = { ...itinerary[dayIndex] };
      day.blocks = [...day.blocks, { ...block, status: block.status || "confirmed" }].sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
      itinerary[dayIndex] = day;
      return { ...prev, itinerary };
    });
  }, []);

  const handleUpdateAccommodation = useCallback((details: AccommodationDetails, bedrooms: BedroomAssignment[]) => {
    setAccommodationDetails(details);
    setBedroomAssignments(bedrooms);
  }, []);

  const handleUpdateDatePoll = useCallback((poll: DatePollData) => {
    setDatePoll(poll);
  }, []);

  const handleLockDates = useCallback((startDate: string, endDate: string) => {
    setPlan((prev) => prev ? { ...prev, startDate, endDate } : prev);
  }, []);

  const handleSave = useCallback(async () => {
    if (!tripId || !plan) return;
    setSaving(true);
    try {
      const planWithExtras = { ...plan, accommodationDetails, bedroomAssignments, datePoll };
      await supabase
        .from("trips")
        .update({ plan_data: planWithExtras as any, updated_at: new Date().toISOString() })
        .eq("id", tripId);
      toast({ title: "Trip saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  }, [tripId, plan, accommodationDetails, bedroomAssignments, datePoll]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <MapPin className="w-12 h-12 text-muted-foreground" />
        <h1 className="text-xl font-display italic text-foreground">{error}</h1>
        <Button variant="outline" onClick={() => navigate("/")} className="gap-2 rounded-xl">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Button>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <Dashboard
      plan={plan}
      conversationHistory={[]}
      onBack={() => navigate(user ? "/my-trips" : "/")}
      hideActionsSidebar={!canEdit}
      hideFloatingChat={!canEdit}
      tripId={tripId}
      accommodationDetails={accommodationDetails}
      bedroomAssignments={bedroomAssignments}
      onUpdateAccommodation={handleUpdateAccommodation}
      isOwner={effectiveRole === "owner"}
      datePoll={datePoll}
      onUpdateDatePoll={handleUpdateDatePoll}
      onLockDates={handleLockDates}
      currentTravelerId={travelers.find((t) => t.isCurrentUser)?.id}
      travelers={travelers}
      expenses={expenses}
      onAddExpense={canEdit ? addExpense : undefined}
      onDeleteExpense={canEdit ? deleteExpense : undefined}
      onUpdateExpense={canEdit ? updateExpense : undefined}
      onOpenTravelers={() => setShowTravelers(true)}
      travelerSlot={tripId ? (
        <TravelerManager
          travelers={travelers}
          expenses={expenses}
          tripId={tripId}
          onAddTraveler={addTraveler}
          onRemoveTraveler={removeTraveler}
          externalOpen={showTravelers}
          onExternalOpenChange={setShowTravelers}
        />
      ) : undefined}
      {...(canEdit
        ? {
            onDeleteBlock: handleDeleteBlock,
            onSwapBlock: handleSwapBlock,
            onUpdateBlockCost: handleUpdateBlockCost,
            onUpdateBlock: handleUpdateBlock,
            onAddActivity: handleAddActivity,
            onSave: handleSave,
            saving,
          }
        : {})}
    />
  );
}
