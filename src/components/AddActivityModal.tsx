import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, MapPin, Clock, DollarSign, Star, Plus } from "lucide-react";
import { BlockCategory, TimeBlock } from "@/types/itinerary";
import { suggestActivities } from "@/lib/chat";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

export interface Suggestion {
  title: string;
  description: string;
  cost?: number;
  rating?: number;
  location?: string;
  category?: string;
}

interface AddActivityModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (block: TimeBlock) => void;
  dayDate: string;
  dayNumber: number;
  tripContext?: string;
  /** Pre-filled slot info from placeholder click */
  slotLabel?: string;
  slotStartTime?: string;
  slotEndTime?: string;
  slotCategory?: BlockCategory;
  /** Pre-loaded suggestions from parent (avoids re-fetch) */
  preloadedSuggestions?: Suggestion[];
}

const CATEGORY_OPTIONS: { value: BlockCategory; label: string }[] = [
  { value: "activity", label: "Activity" },
  { value: "meal", label: "Meal" },
  { value: "transport", label: "Transport" },
  { value: "free", label: "Free Time" },
  { value: "accommodation", label: "Accommodation" },
];

export default function AddActivityModal({
  open,
  onClose,
  onAdd,
  dayDate,
  dayNumber,
  tripContext,
  slotLabel,
  slotStartTime,
  slotEndTime,
  slotCategory,
  preloadedSuggestions,
}: AddActivityModalProps) {
  const isMobile = useIsMobile();
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState(slotStartTime || "09:00");
  const [endTime, setEndTime] = useState(slotEndTime || "12:00");
  const [category, setCategory] = useState<BlockCategory>(slotCategory || "activity");
  const [location, setLocation] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  // AI suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  // Sync preloaded suggestions and form when modal opens with new slot
  useEffect(() => {
    if (open) {
      setStartTime(slotStartTime || "09:00");
      setEndTime(slotEndTime || "12:00");
      setCategory(slotCategory || "activity");
      setTitle("");
      setLocation("");
      setCost("");
      setNotes("");
      if (preloadedSuggestions && preloadedSuggestions.length > 0) {
        setSuggestions(preloadedSuggestions);
        setSuggestionsLoaded(true);
      } else {
        setSuggestions([]);
        setSuggestionsLoaded(false);
      }
    }
  }, [open, slotLabel, slotStartTime, slotEndTime, slotCategory]);

  const resetForm = () => {
    setTitle("");
    setStartTime(slotStartTime || "09:00");
    setEndTime(slotEndTime || "12:00");
    setCategory(slotCategory || "activity");
    setLocation("");
    setCost("");
    setNotes("");
    setSuggestions([]);
    setSuggestionsLoaded(false);
  };

  const fetchSuggestions = async () => {
    if (!tripContext) return;
    setLoadingSuggestions(true);
    try {
      const slotInfo = slotLabel || `${slotCategory || "activity"} from ${startTime} to ${endTime}`;
      const request = `Suggest 4 specific activities for Day ${dayNumber} (${dayDate}), time slot: ${slotInfo}. Return varied options.`;
      const result = await suggestActivities(
        [{ role: "system", content: tripContext }],
        request
      );
      setSuggestions(result.suggestions || []);
      setSuggestionsLoaded(true);
    } catch {
      toast({ title: "Couldn't load suggestions", variant: "destructive" });
    }
    setLoadingSuggestions(false);
  };

  const pickSuggestion = (s: Suggestion) => {
    const block: TimeBlock = {
      id: crypto.randomUUID(),
      title: s.title,
      startTime: slotStartTime || startTime,
      endTime: slotEndTime || endTime,
      category: (s.category as BlockCategory) || slotCategory || "activity",
      location: s.location,
      cost: s.cost,
      notes: s.description,
    };
    onAdd(block);
    resetForm();
    onClose();
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    const block: TimeBlock = {
      id: crypto.randomUUID(),
      title: title.trim(),
      startTime,
      endTime,
      category,
      location: location.trim() || undefined,
      cost: cost ? parseFloat(cost) : undefined,
      notes: notes.trim() || undefined,
    };
    onAdd(block);
    resetForm();
    onClose();
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) { resetForm(); onClose(); }
  };

  const headerContent = (
    <>
      Add to Day {dayNumber}
      {slotLabel && <span className="text-sm font-normal text-muted-foreground ml-2">({slotLabel})</span>}
    </>
  );

  const bodyContent = (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* AI Suggestions section */}
        {tripContext && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-body font-medium text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> AI Suggestions
              </p>
              {!suggestionsLoaded && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-lg text-xs gap-1 glass border-white/20"
                  onClick={fetchSuggestions}
                  disabled={loadingSuggestions}
                >
                  {loadingSuggestions ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {loadingSuggestions ? "Loading..." : "Get Ideas"}
                </Button>
              )}
            </div>

            {loadingSuggestions && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => pickSuggestion(s)}
                    className="glass-card-solid rounded-2xl p-3 min-w-[180px] max-w-[200px] text-left flex-shrink-0 snap-start hover:ring-2 hover:ring-primary/30 active:ring-2 active:ring-primary/30 transition-all space-y-1.5"
                  >
                    <p className="font-body font-semibold text-sm text-foreground line-clamp-2">{s.title}</p>
                    {s.description && (
                      <p className="text-xs text-muted-foreground font-body line-clamp-2">{s.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {s.cost != null && (
                        <span className="flex items-center gap-0.5">
                          <DollarSign className="w-3 h-3" />{s.cost}
                        </span>
                      )}
                      {s.rating != null && (
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{s.rating}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-primary font-semibold">Choose this</span>
                  </button>
                ))}
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="relative">
                <div className="absolute inset-x-0 top-1/2 h-px bg-border/30" />
                <p className="relative text-center text-xs text-muted-foreground bg-transparent px-3 w-fit mx-auto">or add custom</p>
              </div>
            )}
          </div>
        )}

        {/* Custom activity form */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Visit the Colosseum"
              className="glass border-white/20 rounded-xl h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">
                <Clock className="w-3 h-3 inline mr-1" />Start
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="glass border-white/20 rounded-xl h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">
                <Clock className="w-3 h-3 inline mr-1" />End
              </label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="glass border-white/20 rounded-xl h-9 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">Category</label>
            <Select value={category} onValueChange={(v) => setCategory(v as BlockCategory)}>
              <SelectTrigger className="glass border-white/20 rounded-xl h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">
              <MapPin className="w-3 h-3 inline mr-1" />Location
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional"
              className="glass border-white/20 rounded-xl h-9 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">
              <DollarSign className="w-3 h-3 inline mr-1" />Estimated Cost
            </label>
            <Input
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="Optional"
              className="glass border-white/20 rounded-xl h-9 text-sm"
              min={0}
              step={0.01}
            />
          </div>

          <div>
            <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="glass border-white/20 rounded-xl text-sm min-h-[50px] resize-none"
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 pt-2 flex gap-2">
        <Button variant="outline" onClick={() => { resetForm(); onClose(); }} className="flex-1 rounded-xl glass border-white/20">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!title.trim()} className="flex-1 rounded-xl font-display font-semibold gap-1.5">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="glass-card border-white/15 max-h-[85vh] flex flex-col">
          <DrawerHeader>
            <DrawerTitle className="font-display text-lg">{headerContent}</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto flex flex-col">
            {bodyContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass-card border-white/15 sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="font-display text-lg">{headerContent}</DialogTitle>
        </DialogHeader>
        {bodyContent}
      </DialogContent>
    </Dialog>
  );
}
