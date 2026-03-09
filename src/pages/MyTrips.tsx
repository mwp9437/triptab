import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, MapPin, Calendar, Users, LogOut, ArrowLeft, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import luxuryResort from "@/assets/luxury-resort.png";

interface TripRow {
  id: string;
  title: string;
  intake_data: any;
  plan_data: any;
  created_at: string;
  updated_at: string;
}

export default function MyTrips() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .order("updated_at", { ascending: false });
      setTrips((data as any) || []);
      setLoading(false);
    })();
  }, [user]);

  const handleOpen = (trip: TripRow) => {
    navigate("/", { state: { tripId: trip.id, intake: trip.intake_data, plan: trip.plan_data } });
  };

  const handleDelete = async (e: React.MouseEvent, trip: TripRow) => {
    e.stopPropagation();
    if (!window.confirm("Delete this trip? This cannot be undone.")) return;
    await supabase.from("trips").delete().eq("id", trip.id);
    setTrips((prev) => prev.filter((t) => t.id !== trip.id));
  };

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 z-0">
        <img src={luxuryResort} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/90 to-background/95 backdrop-blur-sm" />
      </div>

      <div className="relative z-10">
        <header className="border-b border-white/15 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 glass-card z-40">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="font-display font-bold text-base sm:text-lg text-foreground italic">My Trips</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl glass border-white/20 text-xs sm:text-sm" onClick={() => navigate("/")}>
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Trip</span>
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-xl text-xs sm:text-sm" onClick={signOut}>
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : trips.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
              <p className="text-muted-foreground font-body mb-4">No saved trips yet.</p>
              <Button onClick={() => navigate("/")} className="rounded-xl">
                <Plus className="w-4 h-4 mr-2" /> Plan Your First Trip
              </Button>
            </motion.div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {trips.map((trip, i) => {
                const plan = trip.plan_data as any;
                return (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card
                      className="glass-card rounded-2xl border-white/15 cursor-pointer hover:shadow-xl transition-shadow"
                      onClick={() => handleOpen(trip)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <h3 className="font-display font-bold text-lg text-foreground">{trip.title}</h3>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => handleDelete(e, trip)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground font-body">
                          {plan?.startDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {plan.startDate} → {plan.endDate}
                            </span>
                          )}
                          {plan?.travelers && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {plan.travelers} traveler{plan.travelers > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-3 font-body">
                          Updated {new Date(trip.updated_at).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
