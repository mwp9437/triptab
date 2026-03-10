import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import LandingHub from "@/components/LandingHub";
import WizardContainer from "@/components/wizard/WizardContainer";
import QuickCreateWizard from "@/components/wizard/QuickCreateWizard";
import ExpenseOnlySetup from "@/components/expenses/ExpenseOnlySetup";
import PlanningWorkspace from "@/components/planning/PlanningWorkspace";
import { TripIntake } from "@/types/intake";
import { createEmptyIntake } from "@/lib/parse-input";
import { useAuth } from "@/contexts/AuthContext";

type AppView = "hub" | "wizard" | "quickCreate" | "expensesOnly" | "planning";

export default function Index() {
  const { user } = useAuth();
  const location = useLocation();
  const [view, setView] = useState<AppView>("hub");
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
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSelectPath = (path: "plan" | "group" | "expenses") => {
    if (path === "plan") setView("wizard");
    else if (path === "group") setView("quickCreate");
    else setView("expensesOnly");
  };

  const handleWizardComplete = (finalIntake: TripIntake) => {
    setIntake(finalIntake);
    setLoadedTripId(null);
    setLoadedPlan(null);
    setView("planning");
  };

  const handleQuickCreateComplete = (finalIntake: TripIntake) => {
    setIntake(finalIntake);
    setLoadedTripId(null);
    setLoadedPlan(null);
    setView("planning");
  };

  const handleExpenseOnlyComplete = (finalIntake: TripIntake) => {
    setIntake(finalIntake);
    setLoadedTripId(null);
    setLoadedPlan(null);
    setView("planning");
  };

  const goToHub = () => {
    setView("hub");
    setLoadedTripId(null);
    setLoadedPlan(null);
  };

  return (
    <AnimatePresence mode="wait">
      {view === "hub" && (
        <motion.div key="hub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <LandingHub onSelectPath={handleSelectPath} />
        </motion.div>
      )}
      {view === "wizard" && (
        <motion.div key="wizard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <WizardContainer
            intake={intake}
            onUpdate={setIntake}
            onComplete={handleWizardComplete}
            onBack={goToHub}
          />
        </motion.div>
      )}
      {view === "quickCreate" && (
        <motion.div key="quickCreate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <QuickCreateWizard onComplete={handleQuickCreateComplete} onBack={goToHub} />
        </motion.div>
      )}
      {view === "expensesOnly" && (
        <motion.div key="expensesOnly" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ExpenseOnlySetup onComplete={handleExpenseOnlyComplete} onBack={goToHub} />
        </motion.div>
      )}
      {view === "planning" && (
        <motion.div key="planning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-screen">
          <PlanningWorkspace
            intake={intake}
            onBack={goToHub}
            loadedTripId={loadedTripId}
            loadedPlan={loadedPlan}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
