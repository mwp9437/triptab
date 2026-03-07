import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import WizardContainer from "@/components/wizard/WizardContainer";
import PlanningWorkspace from "@/components/planning/PlanningWorkspace";
import { TripIntake } from "@/types/intake";
import { createEmptyIntake } from "@/lib/parse-input";
import { useAuth } from "@/contexts/AuthContext";

type AppView = "wizard" | "planning";

export default function Index() {
  const { user } = useAuth();
  const location = useLocation();
  const [view, setView] = useState<AppView>("wizard");
  const [intake, setIntake] = useState<TripIntake>(createEmptyIntake());
  const [loadedTripId, setLoadedTripId] = useState<string | null>(null);
  const [loadedPlan, setLoadedPlan] = useState<any>(null);

  // Handle loading saved trip from MyTrips navigation
  useEffect(() => {
    const state = location.state as any;
    if (state?.tripId && state?.plan) {
      setLoadedTripId(state.tripId);
      setLoadedPlan(state.plan);
      if (state.intake) setIntake(state.intake);
      setView("planning");
      // Clear location state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleWizardComplete = (finalIntake: TripIntake) => {
    setIntake(finalIntake);
    setLoadedTripId(null);
    setLoadedPlan(null);
    setView("planning");
  };

  return (
    <AnimatePresence mode="wait">
      {view === "wizard" && (
        <motion.div key="wizard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <WizardContainer
            intake={intake}
            onUpdate={setIntake}
            onComplete={handleWizardComplete}
            onBack={() => {}}
          />
        </motion.div>
      )}
      {view === "planning" && (
        <motion.div key="planning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-screen">
          <PlanningWorkspace
            intake={intake}
            onBack={() => { setView("wizard"); setLoadedTripId(null); setLoadedPlan(null); }}
            loadedTripId={loadedTripId}
            loadedPlan={loadedPlan}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
