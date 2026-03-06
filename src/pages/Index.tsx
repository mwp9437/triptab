import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ChatInterface from "@/components/ChatInterface";
import Dashboard from "@/components/Dashboard";
import { TripPlan } from "@/types/itinerary";
import { generateItinerary } from "@/lib/chat";
import { toast } from "@/hooks/use-toast";

export default function Index() {
  const [view, setView] = useState<"chat" | "dashboard">("chat");
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateItinerary = async (messages: { role: string; content: string }[]) => {
    setIsGenerating(true);
    setConversationHistory(messages);
    try {
      const plan = await generateItinerary(messages);
      setTripPlan(plan);
      setView("dashboard");
    } catch (err) {
      toast({
        title: "Generation failed",
        description: "Couldn't create your itinerary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {view === "chat" ? (
        <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ChatInterface onGenerateItinerary={handleGenerateItinerary} isGenerating={isGenerating} />
        </motion.div>
      ) : tripPlan ? (
        <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Dashboard plan={tripPlan} conversationHistory={conversationHistory} onBack={() => setView("chat")} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
