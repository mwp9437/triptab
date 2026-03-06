import { motion } from "framer-motion";
import { Star, MapPin, Clock, DollarSign, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityOption } from "@/types/intake";
import { BlockCategory } from "@/types/itinerary";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<BlockCategory, string> = {
  transport: "border-l-ocean",
  activity: "border-l-coral",
  meal: "border-l-[hsl(var(--sand-dark))]",
  free: "border-l-seafoam",
  accommodation: "border-l-muted-foreground",
};

interface OptionsPanelProps {
  options: ActivityOption[];
  onSelect: (option: ActivityOption) => void;
  onClose: () => void;
}

export default function OptionsPanel({ options, onSelect, onClose }: OptionsPanelProps) {
  if (options.length === 0) return null;

  const tierLabel = (t: number) => "$".repeat(t);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full bg-card border-l border-border flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-display font-semibold text-sm text-card-foreground">Options</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt)}
            className={cn(
              "w-full text-left rounded-xl border border-border bg-background p-4 hover:shadow-md hover:border-primary/30 transition-all border-l-4",
              CATEGORY_COLORS[opt.category] || "border-l-primary"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-body font-semibold text-sm text-foreground">{opt.title}</h4>
              {opt.rating && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                  <Star className="w-3 h-3 fill-accent text-accent" />
                  {opt.rating}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground font-body mt-1 line-clamp-2">{opt.description}</p>

            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-body">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {opt.startTime}–{opt.endTime}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {opt.location}
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {tierLabel(opt.priceTier)} (~${opt.estimatedCost})
              </span>
            </div>

            {opt.distance && (
              <p className="text-xs text-primary/70 font-body mt-1">{opt.distance}</p>
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
