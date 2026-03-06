import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MapPin, Clock, DollarSign, Star, Loader2,
  Bus, Palmtree, Coffee, Bed, Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { TimeBlock, BlockCategory } from "@/types/itinerary";
import { fetchBlockAlternatives, BlockDetails, BlockAlternative } from "@/lib/chat";

const CATEGORY_LABELS: Record<BlockCategory, string> = {
  transport: "Transport",
  activity: "Activity",
  meal: "Restaurant",
  free: "Free Time",
  accommodation: "Accommodation",
};

const CATEGORY_ICONS: Record<BlockCategory, typeof Bus> = {
  transport: Bus,
  activity: Palmtree,
  meal: Coffee,
  free: Palmtree,
  accommodation: Bed,
};

const CATEGORY_ALT_LABELS: Record<BlockCategory, string> = {
  transport: "Other transport options",
  activity: "Other activities nearby",
  meal: "Other restaurants nearby",
  free: "Other things to do",
  accommodation: "Other places to stay",
};

interface BlockDetailModalProps {
  block: TimeBlock | null;
  tripContext: string;
  onClose: () => void;
  onSwap?: (original: TimeBlock, replacement: BlockAlternative) => void;
}

export default function BlockDetailModal({ block, tripContext, onClose, onSwap }: BlockDetailModalProps) {
  const [data, setData] = useState<BlockDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!block) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchBlockAlternatives(block, tripContext)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError("Couldn't load details. Try again.");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [block?.id]);

  if (!block) return null;

  const Icon = CATEGORY_ICONS[block.category] || Palmtree;
  const categoryLabel = CATEGORY_LABELS[block.category];
  const altLabel = CATEGORY_ALT_LABELS[block.category];

  return (
    <Dialog open={!!block} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl w-[95vw] p-0 overflow-hidden rounded-2xl border-border bg-card max-h-[85vh] flex flex-col [&>button]:z-10">
        {/* Header with category color */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary font-body">
                <Icon className="w-3.5 h-3.5" />
                {categoryLabel}
              </span>
            </div>
            <DialogTitle className="font-display font-bold text-xl text-foreground leading-tight">
              {block.title}
            </DialogTitle>
          </DialogHeader>

          {/* Key details */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground font-body">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {block.startTime} – {block.endTime}
            </span>
            {block.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {block.location}
              </span>
            )}
            {block.cost != null && block.cost > 0 && (
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <DollarSign className="w-4 h-4" />
                {block.cost} per person
              </span>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden">
          <div className="w-full min-w-0 px-6 pb-6 space-y-5">
            {/* Notes */}
            {block.notes && (
              <p className="text-sm text-foreground font-body leading-relaxed break-words whitespace-normal">{block.notes}</p>
            )}

            {/* AI-fetched details */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground font-body">Finding details & alternatives...</span>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive font-body text-center py-4">{error}</p>
            )}

            {data && (
              <>
                {/* Description & highlights */}
                <div className="space-y-3 overflow-x-hidden w-full min-w-0">
                  <p className="w-full max-w-full text-sm text-foreground font-body leading-relaxed break-words whitespace-normal">
                    {data.details.description}
                  </p>
                  {data.details.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-2 w-full">
                      {data.details.highlights.map((h, i) => (
                        <span
                          key={i}
                          className="inline-flex max-w-full items-start gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary font-body whitespace-normal break-words leading-snug"
                        >
                          <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
                          <span className="break-words">{h}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {data.details.tip && (
                    <div className="w-full max-w-full rounded-lg bg-muted p-3 text-xs text-muted-foreground font-body break-words whitespace-normal overflow-x-hidden">
                      <span className="font-semibold text-foreground">Tip:</span> {data.details.tip}
                    </div>
                  )}
                </div>

                {/* Alternatives */}
                {data.alternatives.length > 0 && (
                  <div className="w-full min-w-0">
                    <h3 className="font-display font-semibold text-sm text-foreground mb-3">{altLabel}</h3>
                    <div className="flex w-full max-w-full gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                      {data.alternatives.map((alt) => (
                        <motion.button
                          key={alt.id}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => onSwap?.(block, alt)}
                          className="flex-none w-[220px] rounded-xl border border-border bg-background overflow-hidden text-left snap-start hover:border-primary/50 transition-colors group"
                        >
                          <div className="p-3 space-y-1.5">
                            <p className="font-body font-medium text-sm text-foreground leading-tight line-clamp-1">
                              {alt.title}
                            </p>
                            <p className="text-xs text-muted-foreground font-body line-clamp-2 leading-relaxed">
                              {alt.description}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-0.5 text-xs font-medium text-foreground">
                                <DollarSign className="w-3 h-3" />
                                {alt.cost}
                                <span className="text-muted-foreground ml-0.5">{alt.priceTier}</span>
                              </span>
                              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                <Star className="w-3 h-3 fill-accent text-accent" />
                                {alt.rating}
                              </span>
                            </div>
                            {alt.location && (
                              <p className="flex items-center gap-1 text-[10px] text-muted-foreground font-body line-clamp-1">
                                <MapPin className="w-2.5 h-2.5 shrink-0" />
                                {alt.location}
                              </p>
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
