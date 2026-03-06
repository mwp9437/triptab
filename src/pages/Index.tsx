import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LandingHero from "@/components/LandingHero";
import WizardContainer from "@/components/wizard/WizardContainer";
import PlanningWorkspace from "@/components/planning/PlanningWorkspace";
import { TripIntake, DEFAULT_INTAKE } from "@/types/intake";
import { parseInitialInput, createEmptyIntake } from "@/lib/parse-input";

type AppView = "landing" | "wizard" | "planning";

export default function Index() {
  const [view, setView] = useState<AppView>("landing");
  const [intake, setIntake] = useState<TripIntake>(createEmptyIntake());

  const handleSubmitIdea = (text: string) => {
    const parsed = parseInitialInput(text);
    setIntake({ ...createEmptyIntake(), ...parsed, initialIdea: text });
    setView("wizard");
  };

  const handleWizardComplete = (finalIntake: TripIntake) => {
    setIntake(finalIntake);
    setView("planning");
  };

  return (
    <AnimatePresence mode="wait">
      {view === "landing" && (
        <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <LandingHero onSubmitIdea={handleSubmitIdea} />
        </motion.div>
      )}
      {view === "wizard" && (
        <motion.div key="wizard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <WizardContainer
            intake={intake}
            onUpdate={setIntake}
            onComplete={handleWizardComplete}
            onBack={() => setView("landing")}
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
