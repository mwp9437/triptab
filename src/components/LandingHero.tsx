import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Send, Plane, Brain, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import luxuryTerrace from "@/assets/luxury-terrace.png";

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
  const { user } = useAuth();
  const navigate = useNavigate();

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
    <div className="relative flex flex-col h-screen overflow-hidden">
      {/* Full-bleed background */}
      <div className="absolute inset-0 z-0">
        <img
          src={luxuryTerrace}
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center">
            <Plane className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-white">TripTab</h1>
            <p className="text-xs text-white/70 font-body tracking-luxury uppercase">AI Trip Manager</p>
          </div>
        </div>
        {!user && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full glass border-white/20 text-white hover:bg-white/30 hover:text-white"
            onClick={() => navigate("/auth")}
          >
            <LogIn className="w-4 h-4 mr-1.5" />
            Sign In
          </Button>
        )}
      </header>

      {/* Center content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="inline-block mb-8"
          >
            <div className="w-20 h-20 rounded-3xl glass flex items-center justify-center">
              <Plane className="w-10 h-10 text-white" />
            </div>
          </motion.div>

          <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4 leading-tight">
            Where to next?
          </h2>
          <p className="text-white/80 font-body mb-10 max-w-md mx-auto text-lg">
            Tell me about your dream escape — I'll craft the perfect itinerary.
          </p>

          <div className="flex flex-wrap justify-center gap-2.5 mb-10">
            {SUGGESTIONS.map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                className="rounded-full glass border-white/20 text-white hover:bg-white/30 hover:text-white transition-all"
                onClick={() => handleSubmit(s)}
              >
                {s}
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-white/60 mb-6">
            <Brain className="w-3.5 h-3.5" />
            <span className="font-body tracking-wide">Supports brain dumps — paste anything!</span>
          </div>
        </div>
      </div>

      {/* Bottom input */}
      <div className="relative z-10 p-4 pb-6">
        <div className="max-w-2xl mx-auto">
          <div className="glass rounded-2xl p-2 flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell me about your trip plans..."
              className="min-h-[44px] max-h-[120px] resize-none rounded-xl border-0 bg-transparent font-body text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
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
    </div>
  );
}
