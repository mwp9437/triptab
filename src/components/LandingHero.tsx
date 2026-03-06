import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Plane, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const SUGGESTIONS = [
  "🏖️ Plan a beach getaway for 2",
  "🏔️ Adventure trip with friends",
  "🍕 European food tour",
  "🎌 Two weeks in Japan",
];

interface LandingHeroProps {
  onSubmitIdea: (text: string) => void;
}

export default function LandingHero({ onSubmitIdea }: LandingHeroProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;
    onSubmitIdea(text.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Plane className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">TripCraft</h1>
            <p className="text-xs text-muted-foreground font-body">AI Travel Planner</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="inline-block mb-6"
          >
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Plane className="w-10 h-10 text-primary" />
            </div>
          </motion.div>

          <h2 className="text-3xl font-display font-bold text-foreground mb-3">
            Where to next?
          </h2>
          <p className="text-muted-foreground font-body mb-8 max-w-md mx-auto">
            Tell me about your dream trip — or paste your messy notes. I'll turn them into a perfect itinerary.
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {SUGGESTIONS.map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                className="rounded-full border-border hover:bg-secondary hover:text-secondary-foreground"
                onClick={() => handleSubmit(s)}
              >
                {s}
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-6">
            <Brain className="w-3.5 h-3.5" />
            <span>Supports brain dumps — paste anything!</span>
          </div>
        </div>
      </div>

      <div className="border-t border-border p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me about your trip plans..."
            className="min-h-[44px] max-h-[120px] resize-none rounded-xl border-border bg-card font-body"
            rows={1}
          />
          <Button
            size="icon"
            className="h-[44px] w-[44px] rounded-xl shrink-0 bg-primary hover:bg-primary/90"
            onClick={() => handleSubmit(input)}
            disabled={!input.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
