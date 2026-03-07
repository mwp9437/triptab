import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TripPlan } from "@/types/itinerary";
import Dashboard from "@/components/Dashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Loader2 } from "lucide-react";

export default function SharedTrip() {
  const { tripId } = useParams<{ tripId: string }>();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "viewer";
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Redirect to auth with return URL
      navigate(`/auth?redirect=/trip/${tripId}`);
      return;
    }

    async function fetchTrip() {
      if (!tripId) return;
      setLoading(true);

      // Try to fetch the trip
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

      // Auto-add as collaborator if not owner and not already a collaborator
      if (trip.user_id !== user!.id) {
        const { data: existing } = await supabase
          .from("trip_collaborators")
          .select("id")
          .eq("trip_id", tripId)
          .eq("user_id", user!.id);

        if (!existing || existing.length === 0) {
          await supabase.from("trip_collaborators").insert({
            trip_id: tripId,
            user_id: user!.id,
            invited_email: user!.email || "",
            role: role as any,
            accepted: true,
          } as any);
        }
      }

      setPlan(trip.plan_data as unknown as TripPlan);
      setLoading(false);
    }

    fetchTrip();
  }, [tripId, user, authLoading, navigate]);

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
      hideActionsSidebar
      hideFloatingChat
      tripId={tripId}
    />
  );
}
