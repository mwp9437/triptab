import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MapPin, DollarSign, Star, Loader2, Search, Plus,
  Bus, Palmtree, Coffee, Bed, Send,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TimeBlock, BlockCategory } from "@/types/itinerary";
import { fetchBlockAlternatives, BlockDetails, BlockAlternative } from "@/lib/chat";
import { cn } from "@/lib/utils";

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

const CATEGORY_SEARCH_PLACEHOLDER: Record<BlockCategory, string> = {
  transport: "Search transport options...",
  activity: "Search activities or add your own...",
  meal: "Search restaurants or add your own...",
  free: "Search things to do or add your own...",
  accommodation: "Search hotels or add your own...",
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
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BlockAlternative[] | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [customCost, setCustomCost] = useState("");

  useEffect(() => {
    if (!block) { setData(null); setSearchResults(null); setSearchQuery(""); setShowCustom(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSearchResults(null);
    setSearchQuery("");
    setShowCustom(false);
    fetchBlockAlternatives(block, tripContext)
      .then((result) => { if (!cancelled) { setData(result); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError("Couldn't load alternatives. Try again."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [block?.id]);

  if (!block) return null;

  const Icon = CATEGORY_ICONS[block.category] || Palmtree;
  const altLabel = CATEGORY_ALT_LABELS[block.category];
  const searchPlaceholder = CATEGORY_SEARCH_PLACEHOLDER[block.category];

  const handleSearch = async () => {
    if (!searchQuery.trim() || !block) return;
    setSearching(true);
    try {
      const searchContext = `${tripContext}. User is searching for: "${searchQuery}" as a replacement for "${block.title}" (${block.category}, ${block.startTime}-${block.endTime})`;
      const result = await fetchBlockAlternatives(
        { ...block, title: searchQuery, notes: `Find options similar to: ${searchQuery}` },
        searchContext
      );
      setSearchResults(result.alternatives);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleSearch(); }
  };

  const handleCustomSwap = () => {
    if (!customTitle.trim() || !block) return;
    const custom: BlockAlternative = {
      id: `custom-${Date.now()}`,
      title: customTitle.trim(),
      description: "Custom activity",
      location: customLocation.trim() || "",
      cost: customCost ? Number(customCost) : 0,
      priceTier: "$",
      imageQuery: "",
      rating: 0,
      category: block.category,
    };
    onSwap?.(block, custom);
  };

  const displayAlternatives = searchResults ?? data?.alternatives ?? [];
  const isSearching = searchResults !== null;

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
              Swap <span className="font-medium text-foreground">"{block.title}"</span> for an alternative
            </p>
          </DialogHeader>

          {/* Search bar */}
          <div className="mt-3 flex gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                className="pl-9 h-9 text-xs rounded-xl border-border/50 bg-white/50 backdrop-blur-sm font-body"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-xl border-border/50 bg-white/50 backdrop-blur-sm text-xs font-body"
              onClick={handleSearch}
              disabled={!searchQuery.trim() || searching}
            >
              {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
            <Button
              size="sm"
              variant={showCustom ? "default" : "outline"}
              className={cn("h-9 rounded-xl text-xs font-body gap-1", !showCustom && "border-border/50 bg-white/50 backdrop-blur-sm")}
              onClick={() => setShowCustom(!showCustom)}
            >
              <Plus className="w-3.5 h-3.5" /> Custom
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden">
          <div className="w-full min-w-0 px-6 pb-6 space-y-3">
            {/* Custom entry form */}
            {showCustom && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 space-y-3"
              >
                <p className="text-xs font-body font-semibold text-foreground">Add your own</p>
                <Input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Activity name *"
                  className="h-8 text-xs rounded-lg border-border/50 bg-white/70 font-body"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    placeholder="Location (optional)"
                    className="h-8 text-xs rounded-lg border-border/50 bg-white/70 font-body"
                  />
                  <Input
                    type="number"
                    value={customCost}
                    onChange={(e) => setCustomCost(e.target.value)}
                    placeholder="Cost (optional)"
                    className="h-8 text-xs rounded-lg border-border/50 bg-white/70 font-body"
                    min={0}
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full h-8 rounded-xl text-xs"
                  disabled={!customTitle.trim()}
                  onClick={handleCustomSwap}
                >
                  Replace with "{customTitle || "..."}"
                </Button>
              </motion.div>
            )}

            {/* Search results label */}
            {isSearching && (
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-body font-semibold uppercase tracking-luxury text-muted-foreground">
                  Search results
                </p>
                <button
                  onClick={() => { setSearchResults(null); setSearchQuery(""); }}
                  className="text-[10px] font-body text-primary hover:underline"
                >
                  Show original
                </button>
              </div>
            )}

            {(loading || searching) && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground font-body">
                  {searching ? "Searching..." : "Finding alternatives..."}
                </span>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive font-body text-center py-4">{error}</p>
            )}

            {!loading && !searching && displayAlternatives.length === 0 && data && (
              <p className="text-sm text-muted-foreground font-body text-center py-6">
                {isSearching ? "No results found. Try a different search or add a custom entry." : "No alternatives found."}
              </p>
            )}

            {!loading && !searching && displayAlternatives.map((alt) => (
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
                    {alt.rating > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Star className="w-3 h-3 fill-primary text-primary" />
                        {alt.rating}
                      </span>
                    )}
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
