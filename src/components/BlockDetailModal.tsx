import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MapPin, Clock, DollarSign, Star, Loader2,
  Bus, Palmtree, Coffee, Bed, Sparkles, ImageIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { TimeBlock, BlockCategory } from "@/types/itinerary";
import { fetchBlockAlternatives, fetchBlockImage, BlockDetails, BlockAlternative } from "@/lib/chat";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

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

interface BlockDetailModalProps {
  block: TimeBlock | null;
  tripContext: string;
  onClose: () => void;
  onSwap?: (original: TimeBlock, replacement: BlockAlternative) => void;
}

export default function BlockDetailModal({ block, tripContext, onClose, onSwap }: BlockDetailModalProps) {
  const isMobile = useIsMobile();
  const [data, setData] = useState<BlockDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    if (!block) { setData(null); setImageUrl(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setImageUrl(null);
    setImageLoading(false);

    fetchBlockAlternatives(block, tripContext)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);

        // Fetch image if we have a query
        const query = result.details.imageQuery || `${block.title} ${block.location || ""}`;
        setImageLoading(true);
        fetchBlockImage(query, block.category)
          .then((url) => { if (!cancelled) setImageUrl(url); })
          .finally(() => { if (!cancelled) setImageLoading(false); });
      })
      .catch(() => {
        if (!cancelled) { setError("Couldn't load details. Try again."); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [block?.id]);

  if (!block) return null;

  const Icon = CATEGORY_ICONS[block.category] || Palmtree;
  const categoryLabel = CATEGORY_LABELS[block.category];

  const innerContent = (
    <>
      {/* Hero Image */}
      <div className="relative w-full h-48 sm:h-56 overflow-hidden bg-muted shrink-0">
        {imageLoading || loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground/50 font-body">Loading photo...</span>
            </div>
          </div>
        ) : imageUrl ? (
          <motion.img
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            src={imageUrl}
            alt={block.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-luxury text-white/80 font-body drop-shadow">
              <Icon className="w-3.5 h-3.5" />
              {categoryLabel}
            </span>
          </div>
          <h2 className="font-display font-bold text-xl text-white leading-tight drop-shadow-lg">
            {block.title}
          </h2>
        </div>
      </div>

      <div className="px-6 pt-3 pb-1">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-body">
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

      <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden">
        <div className="w-full min-w-0 px-6 pb-6 space-y-5">
          {block.notes && (
            <p className="text-sm text-foreground font-body leading-relaxed break-words whitespace-normal">{block.notes}</p>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground font-body">Loading details...</span>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive font-body text-center py-4">{error}</p>
          )}

          {data && (
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
                <div className="w-full max-w-full rounded-2xl bg-primary/5 border border-primary/10 p-3 text-xs text-muted-foreground font-body break-words whitespace-normal overflow-x-hidden">
                  <span className="font-semibold text-primary">Tip:</span> {data.details.tip}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={!!block} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DrawerContent className="max-h-[85vh] flex flex-col p-0 overflow-hidden border-white/20 bg-white/90 backdrop-blur-2xl">
          {innerContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={!!block} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl w-[95vw] p-0 overflow-hidden rounded-3xl border-white/20 bg-white/90 backdrop-blur-2xl shadow-2xl max-h-[85vh] flex flex-col [&>button]:z-10">
        {innerContent}
      </DialogContent>
    </Dialog>
  );
}
