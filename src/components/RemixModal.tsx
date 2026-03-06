import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MapPin, DollarSign, Star, Loader2,
  Bus, Palmtree, Coffee, Bed,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TimeBlock, BlockCategory } from "@/types/itinerary";
import { fetchBlockAlternatives, BlockDetails, BlockAlternative } from "@/lib/chat";

const CATEGORY_ALT_LABELS: Record<BlockCategory, string> = {
  transport: "Other transport options",
  activity: "Other activities nearby",
  meal: "Other restaurants nearby",
  free: "Other things to do",
  accommodation: "Other places to stay",
};

const CATEGORY_ICONS: Record<BlockCategory, typeof Bus> = {
  transport: Bus,
  activity: Palmtree,
  meal: Coffee,
  free: Palmtree,
  accommodation: Bed,
};

interface RemixModalProps {
  block: TimeBlock | null;
  tripContext: string;
  onClose: () => void;
  onSwap?: (original: TimeBlock, replacement: BlockAlternative) => void;
}

export default function RemixModal({ block, tripContext, onClose, onSwap }: RemixModalProps) {
  const [data, setData] = useState<BlockDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!block) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBlockAlternatives(block, tripContext)
      .then((result) => { if (!cancelled) { setData(result); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError("Couldn't load alternatives. Try again."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [block?.id]);

  if (!block) return null;

  const Icon = CATEGORY_ICONS[block.category] || Palmtree;
  const altLabel = CATEGORY_ALT_LABELS[block.category];

  return (
    <Dialog open={!!block} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg w-[95vw] p-0 overflow-hidden rounded-3xl border-white/20 bg-white/90 backdrop-blur-2xl shadow-2xl max-h-[85vh] flex flex-col [&>button]:z-10">
        <div className="px-6 pt-6 pb-3">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-luxury text-primary font-body">
                <Icon className="w-3.5 h-3.5" />
                Remix
              </span>
            </div>
            <DialogTitle className="font-display font-bold text-lg text-foreground leading-tight">
              {altLabel}
            </DialogTitle>
            <p className="text-xs text-muted-foreground font-body mt-1">
              Swap <span className="font-medium text-foreground">"{block.title}"</span> for one of these alternatives
            </p>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden">
          <div className="w-full min-w-0 px-6 pb-6 space-y-3">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground font-body">Finding alternatives...</span>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive font-body text-center py-4">{error}</p>
            )}

            {data && data.alternatives.length === 0 && (
              <p className="text-sm text-muted-foreground font-body text-center py-6">No alternatives found.</p>
            )}

            {data && data.alternatives.map((alt) => (
              <motion.button
                key={alt.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSwap?.(block, alt)}
                className="w-full rounded-2xl border border-border/50 bg-white/60 backdrop-blur-sm p-4 text-left hover:border-primary/40 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-medium text-sm text-foreground leading-tight">
                      {alt.title}
                    </p>
                    <p className="text-xs text-muted-foreground font-body mt-1 line-clamp-2 leading-relaxed">
                      {alt.description}
                    </p>
                    {alt.location && (
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground font-body mt-1.5 line-clamp-1">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        {alt.location}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="flex items-center gap-0.5 text-xs font-medium text-foreground">
                      <DollarSign className="w-3 h-3" />
                      {alt.cost}
                    </span>
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      <Star className="w-3 h-3 fill-primary text-primary" />
                      {alt.rating}
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
