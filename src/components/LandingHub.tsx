import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plane, Users, DollarSign, FolderOpen, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import luxuryTerrace from "@/assets/luxury-terrace.png";

interface LandingHubProps {
  onSelectPath: (path: "plan" | "group" | "expenses") => void;
}

const CARDS = [
  {
    path: "plan" as const,
    icon: Plane,
    title: "Plan a Trip",
    description: "AI builds your perfect itinerary from scratch",
    button: "Start Planning",
  },
  {
    path: "group" as const,
    icon: Users,
    title: "Manage a Group Trip",
    description: "Already have a trip? Set up your group, assign rooms, share details",
    button: "Set Up Group",
  },
  {
    path: "expenses" as const,
    icon: DollarSign,
    title: "Split Expenses",
    description: "Track who paid what and settle up at the end",
    button: "Start Splitting",
  },
];

export default function LandingHub({ onSelectPath }: LandingHubProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Background with ken-burns */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img src={luxuryTerrace} alt="" className="w-full h-full object-cover bg-kenburns" />
      </div>
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/15 via-transparent to-black/30" />

      {/* Header */}
      <header className="relative z-10 px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl glass flex items-center justify-center">
            <Plane className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-display font-bold text-white">TripTab</h1>
            <p className="text-[10px] sm:text-xs text-white/70 font-body tracking-luxury uppercase">AI Trip Manager</p>
          </div>
        </div>
        {user ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full bg-foreground text-background hover:bg-foreground/80 border-0 text-xs sm:text-sm"
            onClick={() => navigate("/my-trips")}
          >
            <FolderOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
            My Trips
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full bg-foreground text-background hover:bg-foreground/80 border-0 text-xs sm:text-sm"
            onClick={() => navigate("/auth")}
          >
            <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
            Sign In
          </Button>
        )}
      </header>

      {/* Center content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-14"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white mb-3 leading-tight italic drop-shadow-lg">
            Plan it. Split it. Live it.
          </h2>
          <p className="text-sm sm:text-base text-white/80 font-body max-w-lg mx-auto drop-shadow">
            AI trip planning, group coordination, and expense splitting — all in one place.
          </p>
        </motion.div>

        {/* Three entry cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 w-full max-w-3xl">
          {CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.button
                key={card.path}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.1 }}
                onClick={() => onSelectPath(card.path)}
                className="glass-card rounded-2xl p-6 text-left group hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.15)] hover:border-white/40 active:scale-[0.98] transition-all duration-300 cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center mb-4 group-hover:bg-white/30 transition-colors">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-display font-bold text-lg text-white mb-1.5 drop-shadow">{card.title}</h3>
                <p className="text-xs text-white/70 font-body leading-relaxed mb-4">{card.description}</p>
                <span className="text-sm font-body font-semibold text-white/90 group-hover:underline drop-shadow">
                  {card.button} &rarr;
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Bottom link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-xs text-white/60 font-body"
        >
          {user ? (
            <>
              Already have a trip?{" "}
              <button onClick={() => navigate("/my-trips")} className="text-white hover:underline font-medium">
                View My Trips
              </button>
            </>
          ) : (
            <>
              Already have a trip?{" "}
              <button onClick={() => navigate("/auth")} className="text-white hover:underline font-medium">
                Sign in to access saved trips
              </button>
            </>
          )}
        </motion.p>
      </div>
    </div>
  );
}
