import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import WizardContainer from "@/components/wizard/WizardContainer";
import PlanningWorkspace from "@/components/planning/PlanningWorkspace";
import { TripIntake } from "@/types/intake";
import { createEmptyIntake } from "@/lib/parse-input";

type AppView = "wizard" | "planning";

export default function Index() {
  const [view, setView] = useState<AppView>("wizard");
  const [intake, setIntake] = useState<TripIntake>(createEmptyIntake());

  const handleWizardComplete = (finalIntake: TripIntake) => {
    setIntake(finalIntake);
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
          <PlanningWorkspace intake={intake} onBack={() => setView("wizard")} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
